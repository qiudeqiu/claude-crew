import { InlineKeyboard } from "grammy";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ClaudeResult, ManagedBot } from "./types.js";
import {
  getConfig,
  getBotAccessLevel,
  getBotPermissionMode,
  WRITE_TOOLS,
  READONLY_DISALLOWED,
  TYPING_INTERVAL_MS,
  PROGRESS_THROTTLE_MS,
  APPROVAL_TIMEOUT_MS,
  RESTART_NOTE_FILE,
} from "./config.js";
import { log } from "./logger.js";
import { getSafeEnv, formatToolLabel, splitMessage } from "./helpers.js";
import { daemon, sessionStats, pendingApprovals } from "./state.js";

// ══════════════════════════════════════
// ── Core: run Claude and parse stream ──
// ══════════════════════════════════════
export async function runClaude(
  dir: string,
  prompt: string,
  opts: {
    allowedTools?: string;
    disallowedTools?: string;
    appendSystemPrompt?: string;
    onProgress?: (label: string) => void;
    resume?: boolean;
  } = {},
): Promise<ClaudeResult> {
  const cmd = [
    "claude",
    "-p",
    ...(opts.resume !== false ? ["--continue"] : []),
    "--verbose",
    "--output-format",
    "stream-json",
    ...(opts.appendSystemPrompt
      ? ["--append-system-prompt", opts.appendSystemPrompt]
      : []),
    prompt,
    ...(opts.allowedTools ? ["--allowedTools", opts.allowedTools] : []),
    ...(opts.disallowedTools
      ? ["--disallowedTools", opts.disallowedTools]
      : []),
  ];

  const safeEnv = getSafeEnv();
  const proc = Bun.spawn({
    cmd,
    cwd: dir,
    env: safeEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const killTimeout = setTimeout(
    () => proc.kill("SIGTERM"),
    getConfig().sessionTimeoutMs,
  );

  let resultText = "";
  let permissionDenials: string[] = [];
  let costUSD = 0;
  let durationMs = 0;
  let numTurns = 0;
  let contextUsed = 0;
  let contextWindow = 0;
  let model = "";
  let tokensByModel: Record<string, number> = {};
  let buffer = "";
  const decoder = new TextDecoder();
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        // Result (includes permission_denials)
        if (event.type === "result") {
          resultText =
            typeof event.result === "string"
              ? event.result
              : JSON.stringify(event.result ?? "");
          permissionDenials = (
            (event.permission_denials as Array<unknown>) ?? []
          ).map((d) =>
            typeof d === "string"
              ? d
              : (((d as Record<string, unknown>).tool_name ??
                  (d as Record<string, unknown>).tool ??
                  (d as Record<string, unknown>).name ??
                  "?") as string),
          );
          costUSD = (event.total_cost_usd as number) ?? 0;
          durationMs = (event.duration_ms as number) ?? 0;
          numTurns = (event.num_turns as number) ?? 0;
          // Extract per-model token counts + context info
          const mu =
            (event.modelUsage as Record<string, Record<string, number>>) ?? {};
          for (const [m, info] of Object.entries(mu)) {
            const total =
              (info.inputTokens ?? 0) +
              (info.outputTokens ?? 0) +
              (info.cacheReadInputTokens ?? 0) +
              (info.cacheCreationInputTokens ?? 0);
            tokensByModel[m] = total;
            if (!contextWindow && info.contextWindow) {
              contextWindow = info.contextWindow;
              model = m;
            }
          }
          // Total context = all input + output tokens
          const u = (event.usage as Record<string, number>) ?? {};
          contextUsed =
            (u.input_tokens ?? 0) +
            (u.output_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0);
        }

        // Rate limit event
        if (event.type === "rate_limit_event" && event.rate_limit_info) {
          const rli = event.rate_limit_info as Record<string, unknown>;
          daemon.rateLimitInfo = {
            resetsAt: (rli.resetsAt as number) ?? 0,
            rateLimitType: (rli.rateLimitType as string) ?? "",
            status: (rli.status as string) ?? "",
          };
        }

        // Tool use -> progress callback
        if (
          opts.onProgress &&
          event.type === "assistant" &&
          (event.message as Record<string, unknown>)?.content
        ) {
          const content = (event.message as Record<string, unknown>)
            .content as Array<Record<string, unknown>>;
          for (const block of content) {
            if (block.type !== "tool_use") continue;
            opts.onProgress(
              formatToolLabel(
                (block.name as string) ?? "",
                (block.input as Record<string, unknown>) ?? {},
              ),
            );
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  clearTimeout(killTimeout);

  if (stderr) log(`STDERR: ${dir} — ${stderr.slice(0, 200)}`);

  return {
    text: resultText.trim(),
    permissionDenials,
    costUSD,
    durationMs,
    numTurns,
    tokensByModel,
    contextUsed,
    contextWindow,
    model,
  };
}

// ══════════════════════════════════════
// ── Core: invoke Claude and reply ──
// ══════════════════════════════════════
export async function invokeClaudeAndReply(
  managed: ManagedBot,
  chatId: string,
  userMessage: string,
  imagePath?: string,
): Promise<void> {
  const { config, bot: tgBot } = managed;
  const project = config.assignedProject ?? config.username ?? "?";
  const dir = config.assignedPath ?? homedir();
  const mode = getBotPermissionMode(config);
  const cfg = getConfig();

  if (Date.now() - managed.lastInvoke < cfg.rateLimitMs) {
    await tgBot.api
      .sendMessage(chatId, "\u23f3 \u8bf7\u7a0d\u7b49\u51e0\u79d2\u518d\u8bd5")
      .catch(() => {});
    return;
  }
  if (daemon.activeInvocations >= cfg.maxConcurrent) {
    await tgBot.api
      .sendMessage(
        chatId,
        `\u23f3 ${daemon.activeInvocations}/${cfg.maxConcurrent} \u4efb\u52a1\u6267\u884c\u4e2d\uff0c\u8bf7\u7a0d\u540e`,
      )
      .catch(() => {});
    return;
  }

  managed.busy = true;
  managed.lastInvoke = Date.now();
  daemon.activeInvocations++;

  void tgBot.api.sendChatAction(chatId, "typing").catch(() => {});
  const typingInterval = setInterval(() => {
    void tgBot.api.sendChatAction(chatId, "typing").catch(() => {});
  }, TYPING_INTERVAL_MS);

  log(`INVOKE: ${project} [${mode}] — "${userMessage.slice(0, 80)}"`);

  // Progress display — throttled, created on first tool use
  let statusMsgId: number | null = null;
  const steps: string[] = [];
  const startTime = Date.now();
  let lastProgressUpdate = 0;
  let pendingProgressFlush: ReturnType<typeof setTimeout> | null = null;

  function flushProgress(): void {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const recent = steps.slice(-5);
    const text =
      `\u2699\ufe0f working... (${elapsed}s)\n` +
      recent.map((s) => `  \u2192 \ud83d\udd27 ${s}`).join("\n");
    if (statusMsgId) {
      void tgBot.api.editMessageText(chatId, statusMsgId, text).catch(() => {});
    } else {
      tgBot.api
        .sendMessage(chatId, text)
        .then((sent) => {
          statusMsgId = sent.message_id;
        })
        .catch(() => {});
    }
    lastProgressUpdate = Date.now();
  }

  function onProgress(step: string): void {
    steps.push(step);
    const now = Date.now();
    if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS) {
      if (pendingProgressFlush) clearTimeout(pendingProgressFlush);
      flushProgress();
    } else if (!pendingProgressFlush) {
      pendingProgressFlush = setTimeout(
        () => {
          pendingProgressFlush = null;
          flushProgress();
        },
        PROGRESS_THROTTLE_MS - (now - lastProgressUpdate),
      );
    }
  }

  try {
    const cleanMsg = userMessage.replace(/@\w+/g, "").trim();
    const prompt = imagePath
      ? `\u7528\u6237\u53d1\u9001\u4e86\u4e00\u5f20\u56fe\u7247\uff0c\u8def\u5f84: ${imagePath}\u3002\u8bf7\u5148\u7528 Read \u5de5\u5177\u67e5\u770b\u8fd9\u5f20\u56fe\u7247\uff0c\u7136\u540e\u56de\u7b54: ${cleanMsg || "\u5206\u6790\u8fd9\u5f20\u56fe\u7247"}`
      : cleanMsg;

    const isDaemonProject = existsSync(join(dir, "src", "daemon.ts"));
    const safeProject = project.replace(/['"\\]/g, "_");
    const restartNotePath = RESTART_NOTE_FILE;
    const systemPrompt = isDaemonProject
      ? `WARNING: You are running inside the telegram-pool daemon. If you modify daemon.ts or related files, you MUST: 1) finish ALL edits first, 2) send your reply/summary to the user, 3) write a restart note: echo '{"project":"${safeProject}","summary":"<what you did>"}' > ${restartNotePath}, 4) ONLY THEN run daemon.sh restart as the very last command. Restarting kills your process — anything after it will not execute.`
      : undefined;

    const accessLevel = getBotAccessLevel(config);
    let result: ClaudeResult;

    if (accessLevel === "readOnly") {
      // ReadOnly: hard-restrict to read-only tools via --disallowedTools
      result = await runClaude(dir, prompt, {
        disallowedTools: READONLY_DISALLOWED,
        appendSystemPrompt:
          (systemPrompt ? systemPrompt + "\n\n" : "") +
          "You are in read-only mode. You cannot edit, write, or create files. Only read, search, and analyze.",
        onProgress,
      });
    } else if (mode === "approve") {
      // ReadWrite + Approve: first run without write tools, then ask
      result = await runClaude(dir, prompt, {
        appendSystemPrompt: systemPrompt,
        onProgress,
      });

      // If tools were denied, ask user for approval
      if (result.permissionDenials.length > 0) {
        const denied = [...new Set(result.permissionDenials)];
        log(`APPROVE: denied tools: ${denied.join(", ")}`);

        const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const toolList = denied.map((t) => `  \u2022 ${t}`).join("\n");
        const keyboard = new InlineKeyboard()
          .text(
            "\u2705 \u5141\u8bb8\u5e76\u91cd\u8bd5",
            `approve:yes:${approvalId}`,
          )
          .text("\u274c \u4e0d\u9700\u8981", `approve:no:${approvalId}`);

        await tgBot.api
          .sendMessage(
            chatId,
            `\ud83d\udd12 Claude \u9700\u8981\u4ee5\u4e0b\u5de5\u5177\u6743\u9650:\n${toolList}\n\n\u5141\u8bb8\u540e\u5c06\u91cd\u65b0\u6267\u884c`,
            { reply_markup: keyboard },
          )
          .catch(() => {});

        const approved = await new Promise<string | null>((resolve) => {
          pendingApprovals.set(approvalId, { resolve });
          setTimeout(() => {
            if (pendingApprovals.has(approvalId)) {
              pendingApprovals.delete(approvalId);
              resolve(null);
            }
          }, APPROVAL_TIMEOUT_MS);
        });

        if (approved) {
          log(`APPROVE: retrying with tools: ${approved}`);
          steps.length = 0;
          result = await runClaude(dir, prompt, {
            allowedTools: approved,
            appendSystemPrompt: systemPrompt,
            onProgress,
            resume: false,
          });
        }
      }
    } else {
      // ReadWrite + AllowAll: pre-authorize everything
      result = await runClaude(dir, prompt, {
        allowedTools: WRITE_TOOLS,
        appendSystemPrompt: systemPrompt,
        onProgress,
      });
    }

    // Delete progress message
    if (statusMsgId) {
      await tgBot.api.deleteMessage(chatId, statusMsgId).catch(() => {});
    }

    if (!result.text) {
      await tgBot.api
        .sendMessage(chatId, "(\u65e0\u8f93\u51fa)")
        .catch(() => {});
      return;
    }

    for (const chunk of splitMessage(result.text)) {
      await tgBot.api.sendMessage(chatId, chunk);
    }

    // Accumulate session stats
    sessionStats.totalCostUSD += result.costUSD;
    sessionStats.totalDurationMs += result.durationMs;
    sessionStats.totalInvocations++;
    for (const [m, tokens] of Object.entries(result.tokensByModel)) {
      sessionStats.tokensByModel[m] =
        (sessionStats.tokensByModel[m] ?? 0) + tokens;
    }

    managed.lastActivity = Date.now();
    managed.contextUsed = result.contextUsed;
    managed.contextWindow = result.contextWindow;
    managed.lastModel = result.model;
    managed.lastCostUSD += result.costUSD;
    log(
      `DONE: ${project} — ${result.text.length} chars, $${result.costUSD.toFixed(4)}, context ${result.contextWindow ? Math.round((result.contextUsed / result.contextWindow) * 100) : "?"}%`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`FAIL: ${project} — ${msg}`);
    await tgBot.api
      .sendMessage(chatId, `\u26a0\ufe0f \u5931\u8d25: ${msg.slice(0, 200)}`)
      .catch(() => {});
  } finally {
    if (pendingProgressFlush) clearTimeout(pendingProgressFlush);
    clearInterval(typingInterval);
    managed.busy = false;
    daemon.activeInvocations = Math.max(0, daemon.activeInvocations - 1);
  }
}
