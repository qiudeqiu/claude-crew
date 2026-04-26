// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { IncomingMessage, ServerResponse } from "http";
import { loadPool, getOwner, APPROVAL_TIMEOUT_MS } from "../config.js";
import { daemon, managedBots } from "../state.js";
import { log } from "../logger.js";
import {
  createAuthRequest,
  updateMessageId,
} from "./authRequestStore.js";

interface HookPayload {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  project?: string;
}

/** Find the best bot to push auth request for a given cwd. */
function resolveBot(cwd: string) {
  const pool = loadPool();
  // Prefix match with path separator guard
  const match = pool.bots.find(
    (b) =>
      b.role === "project" &&
      b.assignedPath &&
      (cwd === b.assignedPath ||
        cwd.startsWith(b.assignedPath.replace(/\/?$/, "/"))),
  );
  if (match) {
    const managed = [...managedBots.values()].find(
      (m) => m.config.token === match.token,
    );
    if (managed) return { managed, project: match.assignedProject ?? null };
  }
  return { managed: daemon.masterBot, project: null };
}

/** Summarize tool input for display (truncate long values). */
function summarizeInput(toolName: string, input: Record<string, unknown>): string {
  const key =
    toolName === "Bash" ? "command" :
    toolName === "Write" ? "file_path" :
    toolName === "Edit" ? "file_path" :
    toolName === "WebFetch" ? "url" :
    Object.keys(input)[0];
  if (!key) return "";
  const val = String(input[key] ?? "");
  return val.length > 120 ? val.slice(0, 120) + "…" : val;
}

export async function handleAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  authToken: string | null,
): Promise<void> {
  // Validate token if configured
  if (authToken) {
    const provided = req.headers["x-auth-token"];
    if (provided !== authToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
  }

  // Read body
  const body = await new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const toolName = payload.tool_name ?? "Unknown";
  const toolInput = payload.tool_input ?? {};
  const cwd = payload.cwd ?? process.cwd();
  const sessionId = payload.session_id ?? "unknown";
  const project = payload.project ?? "";

  const { managed, project: botProject } = resolveBot(cwd);
  if (!managed) {
    // No bot available — auto-allow (daemon not ready)
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "allow" }));
    return;
  }

  const pool = loadPool();
  if (!(pool.pushAuthEnabled ?? false)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "allow" }));
    return;
  }

  const failMode = pool.pushAuthFailMode ?? "open";
  const failStatus = failMode === "block" ? "deny" : "allow";

  const lang = pool.language === "zh" ? "zh" : "en";
  const ownerChatId = pool.sharedGroupId ?? getOwner();
  if (!ownerChatId) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: failStatus }));
    return;
  }

  const displayProject = botProject ?? project;
  const summary = summarizeInput(toolName, toolInput as Record<string, unknown>);
  const shortCwd = cwd.replace(process.env.HOME ?? "", "~");

  const msgLines = lang === "zh"
    ? [
        "🔐 授权请求",
        "",
        `工具: ${toolName}`,
        summary ? `参数: ${summary}` : "",
        "",
        `📂 目录: ${shortCwd}`,
        displayProject ? `📦 项目: ${displayProject}` : "",
        `🕐 等待审批 (${APPROVAL_TIMEOUT_MS / 1000}s)`,
      ]
    : [
        "🔐 Authorization Request",
        "",
        `Tool: ${toolName}`,
        summary ? `Input: ${summary}` : "",
        "",
        `📂 Dir: ${shortCwd}`,
        displayProject ? `📦 Project: ${displayProject}` : "",
        `🕐 Awaiting approval (${APPROVAL_TIMEOUT_MS / 1000}s)`,
      ];

  const msgText = msgLines.filter(Boolean).join("\n");

  const { id, promise } = createAuthRequest({
    sessionId,
    toolName,
    toolInput,
    cwd,
    project: displayProject,
    timeoutMs: APPROVAL_TIMEOUT_MS,
    botUsername: managed.config.username ?? "",
    chatId: ownerChatId,
  });

  const allowLabel = lang === "zh" ? "✅ 允许" : "✅ Allow";
  const denyLabel = lang === "zh" ? "❌ 拒绝" : "❌ Deny";

  try {
    const sent = await managed.platform.sendButtons(ownerChatId, msgText, [
      [
        { text: allowLabel, data: `auth:allow:${id}` },
        { text: denyLabel, data: `auth:deny:${id}` },
      ],
    ]);
    if (sent?.id) updateMessageId(id, sent.id);
  } catch (e) {
    log(`AUTH: failed to push IM message — ${e}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: failStatus }));
    return;
  }

  log(`AUTH: pending ${id} [${toolName}] from ${shortCwd}`);

  const status = await promise;
  log(`AUTH: ${id} → ${status}`);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status }));
}
