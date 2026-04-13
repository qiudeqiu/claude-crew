// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import { existsSync } from "fs";
import { randomBytes } from "crypto";
import { homedir } from "os";
import { join } from "path";
import type { ClaudeResult, ManagedBot } from "./types.js";
import { hasFileSupport } from "./platform/types.js";
import {
  getConfig,
  loadPool,
  canUseBot,
  getBotAccessLevel,
  getBotPermissionMode,
  getBotModel,
  getSessionMode,
  WRITE_TOOLS,
  READONLY_DISALLOWED,
  LARK_WRITE_TOOLS,
  LARK_SENSITIVE_TOOLS,
  getPlatform,
  TYPING_INTERVAL_MS,
  PROGRESS_THROTTLE_MS,
  APPROVAL_TIMEOUT_MS,
  RESTART_NOTE_FILE,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  CIRCUIT_BREAKER_MAX_FAILURES,
  MAX_TRUNCATION_RECOVERIES,
  CONTEXT_AUTO_COMPACT_THRESHOLD,
  getMessageLimit,
} from "./config.js";
import { log } from "./logger.js";
import { getSafeEnv, formatToolLabel, splitMessage } from "./helpers.js";
import { daemon, sessionStats, pendingApprovals } from "./state.js";
import { getLang, setupMsg } from "./interactive/i18n.js";
import {
  isCircuitOpen,
  getCircuitInfo,
  recordSuccess,
  recordFailure,
  tripCircuit,
  recordDenial,
  clearDenials,
  classifyError,
  shouldAutoContinue,
  getAdaptiveDelay,
} from "./resilience.js";

// ══════════════════════════════════════
// ── Core: run Claude and parse stream ──
// ══════════════════════════════════════
export async function runClaude(
  dir: string,
  prompt: string,
  opts: {
    allowedTools?: string;
    disallowedTools?: string;
    permissionMode?: string;
    model?: string;
    effort?: string;
    appendSystemPrompt?: string;
    onProgress?: (label: string) => void;
    resume?: boolean;
  } = {},
): Promise<ClaudeResult> {
  const cmd = [
    "claude",
    "-p",
    ...(opts.resume === false ? [] : ["--continue"]),
    "--verbose",
    "--output-format",
    "stream-json",
    ...(opts.permissionMode ? ["--permission-mode", opts.permissionMode] : []),
    ...(opts.model ? ["--model", opts.model] : []),
    ...(opts.effort ? ["--effort", opts.effort] : []),
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

  let timedOut = false;
  const killTimeout = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
    setTimeout(() => proc.kill("SIGKILL"), 5000);
  }, getConfig().sessionTimeoutMs);

  let resultText = "";
  let assistantText = ""; // fallback: accumulate text from assistant messages
  let permissionDenials: string[] = [];
  let costUSD = 0;
  let durationMs = 0;
  let numTurns = 0;
  let contextUsed = 0;
  let contextWindow = 0;
  let model = "";
  let stopReason = "";
  let tokensByModel: Record<string, number> = {};
  let buffer = "";
  let gotResultEvent = false;
  const decoder = new TextDecoder();
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();

  function processEvent(event: Record<string, unknown>): void {
    // Result (includes permission_denials)
    if (event.type === "result") {
      gotResultEvent = true;
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
      stopReason =
        (event.stop_reason as string) ?? (event.subtype as string) ?? "";
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

    // Assistant message -> extract text blocks as fallback + progress callback
    if (
      event.type === "assistant" &&
      (event.message as Record<string, unknown>)?.content
    ) {
      const content = (event.message as Record<string, unknown>)
        .content as Array<Record<string, unknown>>;
      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") {
          assistantText += (assistantText ? "\n" : "") + block.text;
        }
        if (opts.onProgress && block.type === "tool_use") {
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
        processEvent(event);
      }
    }

    // Process any remaining data in buffer (last line without trailing newline)
    const remaining = buffer.trim();
    if (remaining) {
      try {
        const event = JSON.parse(remaining) as Record<string, unknown>;
        processEvent(event);
      } catch {
        // not valid JSON, ignore
      }
    }
  } finally {
    reader.releaseLock();
    clearTimeout(killTimeout);
  }

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (stderr) log(`STDERR: ${dir} — ${stderr.slice(0, 200)}`);
  if (exitCode !== 0) log(`EXIT: ${dir} — code ${exitCode}`);
  if (!gotResultEvent) log(`WARN: ${dir} — no result event in stream`);

  // Fallback: if result event had empty text, use accumulated assistant text
  let finalText = resultText.trim() || assistantText.trim();

  if (timedOut) {
    const timeoutNote = setupMsg(getLang()).sessionTimedOut(
      Math.round(getConfig().sessionTimeoutMs / 60000),
    );
    finalText = finalText ? `${finalText}\n\n${timeoutNote}` : timeoutNote;
    log(
      `TIMEOUT: ${dir} — killed after ${Math.round(getConfig().sessionTimeoutMs / 60000)}min`,
    );
  }

  return {
    text: finalText,
    permissionDenials,
    costUSD,
    durationMs,
    numTurns,
    tokensByModel,
    contextUsed,
    contextWindow,
    model,
    stopReason,
    exitCode,
    gotResultEvent,
  };
}

// ══════════════════════════════════════
// ── Progress tracker ──
// ══════════════════════════════════════
type ProgressTracker = {
  onProgress: (step: string) => void;
  cleanup: () => void;
  deleteStatusMsg: () => Promise<void>;
  resetSteps: () => void;
};

function createProgressTracker(
  tgBot: ManagedBot["platform"],
  chatId: string,
): ProgressTracker {
  let statusMsgId: string | null = null;
  let statusSending = false; // Prevent duplicate sendMessage before async resolves
  const steps: string[] = [];
  const startTime = Date.now();
  let lastProgressUpdate = 0;
  let pendingFlush: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const recent = steps.slice(-5);
    if (statusMsgId) {
      // Update existing message (no-op on WeChat, which is desired)
      const text =
        `\u2699\ufe0f working... (${elapsed}s)\n` +
        recent.map((s) => `  \u2192 \ud83d\udd27 ${s}`).join("\n");
      void tgBot.editMessage(chatId, statusMsgId, text).catch(() => {});
    } else if (!statusSending) {
      // First progress message — only send once
      statusSending = true;
      const text =
        getPlatform() === "wechat"
          ? "\ud83d\udd27 正在处理中，请稍等，有结果会回复..."
          : `\u2699\ufe0f working... (${elapsed}s)\n` +
            recent.map((s) => `  \u2192 \ud83d\udd27 ${s}`).join("\n");
      tgBot
        .sendMessage(chatId, text)
        .then((sent) => {
          statusMsgId = sent.id;
        })
        .catch(() => {});
    }
    lastProgressUpdate = Date.now();
  }

  return {
    onProgress(step: string): void {
      steps.push(step);
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS) {
        if (pendingFlush) clearTimeout(pendingFlush);
        flush();
      } else if (!pendingFlush) {
        pendingFlush = setTimeout(
          () => {
            pendingFlush = null;
            flush();
          },
          PROGRESS_THROTTLE_MS - (now - lastProgressUpdate),
        );
      }
    },
    cleanup(): void {
      if (pendingFlush) clearTimeout(pendingFlush);
    },
    async deleteStatusMsg(): Promise<void> {
      if (statusMsgId) {
        await tgBot.deleteMessage(chatId, statusMsgId).catch(() => {});
      }
    },
    resetSteps(): void {
      steps.length = 0;
    },
  };
}

// ══════════════════════════════════════
// ── Approval flow ──
// ══════════════════════════════════════
async function requestApproval(
  tgBot: ManagedBot["platform"],
  chatId: string,
  denied: string[],
  config: ManagedBot["config"],
): Promise<string | null> {
  const approvalId = randomBytes(16).toString("hex");
  const toolList = denied.map((t) => `  \u2022 ${t}`).join("\n");

  const pool = loadPool();
  const approvers = config.approvers ?? pool.approvers ?? [];
  const lang = getLang();

  const allowLabel =
    approvers.length > 0
      ? lang === "zh"
        ? `✅ 允许 (0/${approvers.length})`
        : `✅ Allow (0/${approvers.length})`
      : "\u2705 Allow & retry";

  const timeoutMin = Math.round(APPROVAL_TIMEOUT_MS / 60000);
  await tgBot
    .sendButtons(chatId, setupMsg(lang).approvalPrompt(toolList, timeoutMin), [
      [
        { text: allowLabel, data: `approve:yes:${approvalId}` },
        { text: "\u274c Skip", data: `approve:no:${approvalId}` },
      ],
    ])
    .catch(() => {});

  return new Promise<string | null>((resolve) => {
    pendingApprovals.set(approvalId, {
      resolve,
      approvedBy: new Set(),
      requiredApprovers: approvers,
    });
    setTimeout(() => {
      if (pendingApprovals.has(approvalId)) {
        pendingApprovals.delete(approvalId);
        resolve(null);
      }
    }, APPROVAL_TIMEOUT_MS);
  });
}

// ══════════════════════════════════════
// ── Stats accumulation ──
// ══════════════════════════════════════
function accumulateStats(managed: ManagedBot, result: ClaudeResult): void {
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
}

// ══════════════════════════════════════
// ── Build system prompt ──
// ══════════════════════════════════════
function buildSystemPrompt(project: string, dir: string): string | undefined {
  const parts: string[] = [];

  // Daemon self-modification warning
  const isDaemonProject = existsSync(join(dir, "src", "daemon.ts"));
  if (isDaemonProject) {
    const safeProject = project.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_");
    parts.push(
      `WARNING: You are running inside the Claude Crew daemon. If you modify daemon.ts or related files, you MUST: 1) finish ALL edits first, 2) send your reply/summary to the user, 3) write a restart note: echo '{"project":"${safeProject}","summary":"<what you did>"}' > ${RESTART_NOTE_FILE}, 4) ONLY THEN run daemon.sh restart as the very last command. Restarting kills your process — anything after it will not execute.`,
    );
  }

  // Feishu: Lark CLI tool instructions
  if (getPlatform() === "feishu") {
    parts.push(
      "You have access to Feishu/Lark CLI tools via the Bash tool. " +
        "Use `lark-cli` commands for Feishu operations: " +
        "lark-doc (documents), lark-sheets (spreadsheets), lark-base (databases), " +
        "lark-task (tasks), lark-wiki (knowledge base), lark-drive (files), " +
        "lark-whiteboard (diagrams). " +
        "IMPORTANT: Use `--as bot` flag by default (e.g. `lark-cli docs +create --as bot ...`). " +
        "Only use `--as user` if the user explicitly asks for docs under their own name AND user auth is configured. " +
        "If `--as user` fails with auth error, fall back to `--as bot`. " +
        "Run `lark-cli <skill> --help` for usage details.",
    );
  }

  // WeChat: wecom-cli for enterprise WeChat operations (only when enabled)
  if (getPlatform() === "wechat" && loadPool().wecomEnabled) {
    const publicHint = loadPool().wecomPublicDocs
      ? " When creating documents, set sharing permissions to public so the user can open the link in personal WeChat."
      : "";
    parts.push(
      "You have access to WeChat Work (企业微信) CLI tools via the Bash tool. " +
        "Use `wecom-cli` commands for enterprise operations: " +
        "doc (documents/spreadsheets), meeting (video conferences), " +
        "schedule (calendar events), todo (task management), " +
        "contact (member lookup), msg (messaging). " +
        "Run `wecom-cli <command> --help` for usage details. " +
        "Parameters are passed as JSON strings, e.g.: " +
        '`wecom-cli doc create_doc \'{"spaceid":"...","name":"...","content":"..."}\'`' +
        publicHint,
    );
  }

  // File sending instruction — all platforms
  parts.push(
    "To send a file (image, PDF, etc.) to the user in the chat, include this marker in your text output: " +
      "[[FILE:/absolute/path/to/file.png]]. " +
      "The daemon will automatically upload and send the file through the bot. " +
      "You can include multiple [[FILE:...]] markers. Always use absolute paths.",
  );

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

/**
 * Build the disallowedTools string for Feishu Lark tool tier restrictions.
 * - readOnly: block all write tools + all Lark write + all Lark sensitive
 * - normal: block Lark sensitive tools unless bot has them opted in
 */
function buildLarkDisallowed(
  accessLevel: string,
  larkSensitiveOpts?: string[],
): string | undefined {
  if (getPlatform() !== "feishu") return undefined;

  const blocked: string[] = [];

  if (accessLevel === "readOnly") {
    // Block all Lark write and sensitive tools
    blocked.push(...LARK_WRITE_TOOLS, ...LARK_SENSITIVE_TOOLS);
  } else {
    // Block sensitive tools not opted in
    const allowed = new Set(larkSensitiveOpts ?? []);
    for (const tool of LARK_SENSITIVE_TOOLS) {
      if (!allowed.has(tool)) blocked.push(tool);
    }
  }

  return blocked.length > 0 ? blocked.join(",") : undefined;
}

// ══════════════════════════════════════
// ── Core: invoke Claude and reply ──
// ══════════════════════════════════════
export async function invokeClaudeAndReply(
  managed: ManagedBot,
  chatId: string,
  userMessage: string,
  imagePath?: string,
  requesterName?: string,
): Promise<void> {
  const { platform } = managed;
  // Read live config — reflects runtime changes (permissionMode, accessLevel, model, approvers)
  const pool = loadPool();
  const config =
    pool.bots.find((b) => b.username === managed.config.username) ??
    managed.config;
  const project = config.assignedProject ?? config.username ?? "?";
  const dir = config.assignedPath ?? homedir();
  const mode = getBotPermissionMode(config);
  const botModel = getBotModel(config);
  const botEffort = managed.effort;
  const shouldContinue =
    !managed.skipContinue && getSessionMode() === "continue";
  managed.skipContinue = false; // reset after reading
  const cfg = getConfig();

  const s = setupMsg(getLang());
  const botKey = config.username ?? config.token.slice(0, 8);

  // ── Resilience: circuit breaker ──
  if (isCircuitOpen(botKey)) {
    const info = getCircuitInfo(botKey);
    const remaining = info?.trippedAt
      ? Math.max(
          0,
          Math.ceil(
            (CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - info.trippedAt)) /
              1000,
          ),
        )
      : 0;
    await platform
      .sendMessage(
        chatId,
        s.circuitOpen(botKey, info?.lastError ?? "", remaining),
      )
      .catch(() => {});
    return;
  }

  // ── Resilience: adaptive rate limiting ──
  const adaptiveMs = getAdaptiveDelay(daemon.rateLimitInfo);
  if (adaptiveMs > 3000) {
    await platform
      .sendMessage(chatId, s.adaptiveRateLimit(Math.ceil(adaptiveMs / 1000)))
      .catch(() => {});
    return;
  }

  if (Date.now() - managed.lastInvoke < cfg.rateLimitMs) {
    await platform.sendMessage(chatId, s.rateLimited).catch(() => {});
    return;
  }
  if (daemon.activeInvocations >= cfg.maxConcurrent) {
    await platform
      .sendMessage(
        chatId,
        s.queueFull(daemon.activeInvocations, cfg.maxConcurrent),
      )
      .catch(() => {});
    return;
  }

  managed.busy = true;
  managed.lastInvoke = Date.now();
  daemon.activeInvocations++;

  void platform.sendTyping(chatId).catch(() => {});
  const typingInterval = setInterval(() => {
    void platform.sendTyping(chatId).catch(() => {});
  }, TYPING_INTERVAL_MS);

  log(`INVOKE: ${project} [${mode}] — "${userMessage.slice(0, 80)}"`);

  const progress = createProgressTracker(platform, chatId);

  try {
    const cleanMsg = userMessage.replace(/@[\w-]+/g, "").trim();
    const safeImagePath = imagePath?.replace(/[^\w/.\-]/g, "_");
    const prompt = safeImagePath
      ? `The user sent an image at path: ${safeImagePath}. Please use the Read tool to view the image first, then respond: ${cleanMsg || "Analyze this image"}`
      : cleanMsg;

    const systemPrompt = buildSystemPrompt(project, dir);
    const accessLevel = getBotAccessLevel(config);
    const larkDisallowed = buildLarkDisallowed(
      accessLevel,
      config.larkSensitiveTools,
    );
    let result: ClaudeResult;

    if (accessLevel === "readOnly") {
      const disallowed = [READONLY_DISALLOWED, larkDisallowed]
        .filter(Boolean)
        .join(",");
      result = await runClaude(dir, prompt, {
        disallowedTools: disallowed,
        model: botModel,
        effort: botEffort,
        resume: shouldContinue,
        appendSystemPrompt:
          (systemPrompt ? systemPrompt + "\n\n" : "") +
          "You are in read-only mode. You cannot edit, write, or create files. Only read, search, and analyze.",
        onProgress: progress.onProgress,
      });
    } else if (mode === "approve") {
      result = await runClaude(dir, prompt, {
        model: botModel,
        effort: botEffort,
        resume: shouldContinue,
        appendSystemPrompt: systemPrompt,
        disallowedTools: larkDisallowed,
        onProgress: progress.onProgress,
      });

      if (result.permissionDenials.length > 0) {
        const denied = [...new Set(result.permissionDenials)];
        log(`APPROVE: denied tools: ${denied.join(", ")}`);
        const firstResultText = result.text;

        const approved = await requestApproval(
          platform,
          chatId,
          denied,
          config,
        );
        if (approved) {
          clearDenials(botKey);
          log(`APPROVE: retrying with tools: ${approved}`);
          progress.resetSteps();
          result = await runClaude(
            dir,
            prompt +
              "\n\nTools authorized. After execution, reply with a text summary of the results instead of only returning tool calls.",
            {
              allowedTools: approved,
              model: botModel,
              effort: botEffort,
              appendSystemPrompt: systemPrompt,
              onProgress: progress.onProgress,
              resume: false,
            },
          );
          if (!result.text && firstResultText) {
            result = { ...result, text: firstResultText };
          }
          if (!result.text && result.numTurns > 0) {
            result = { ...result, text: setupMsg(getLang()).taskDone };
          }
        } else {
          // Denial tracking: too many skips → suggest mode change
          if (recordDenial(botKey)) {
            await platform
              .sendMessage(chatId, s.denialLimitReached)
              .catch(() => {});
          }
        }
      }
    } else if (mode === "auto") {
      result = await runClaude(dir, prompt, {
        permissionMode: "auto",
        model: botModel,
        effort: botEffort,
        resume: shouldContinue,
        appendSystemPrompt: systemPrompt,
        disallowedTools: larkDisallowed,
        onProgress: progress.onProgress,
      });
    } else {
      // allowAll: bypass all permission checks (including MCP tools)
      // Still block non-opted-in Lark sensitive tools for safety
      result = await runClaude(dir, prompt, {
        permissionMode: "bypassPermissions",
        model: botModel,
        effort: botEffort,
        resume: shouldContinue,
        appendSystemPrompt: systemPrompt,
        disallowedTools: larkDisallowed,
        onProgress: progress.onProgress,
      });
    }

    // ── Resilience: output truncation recovery ──
    // If max_output_tokens was hit, auto-continue to get the full response.
    let truncationRecoveries = 0;
    while (shouldAutoContinue(result.stopReason, truncationRecoveries)) {
      truncationRecoveries++;
      log(
        `TRUNCATION: ${project} — recovery ${truncationRecoveries}, continuing...`,
      );
      await platform
        .sendMessage(
          chatId,
          s.truncationContinue(truncationRecoveries, MAX_TRUNCATION_RECOVERIES),
        )
        .catch(() => {});
      progress.resetSteps();
      const continued = await runClaude(
        dir,
        "Continue from where you left off. Resume your output directly without repeating what was already said.",
        {
          model: botModel,
          effort: botEffort,
          resume: true, // --continue to resume context
          appendSystemPrompt: systemPrompt,
          onProgress: progress.onProgress,
        },
      );
      // Merge: append continued text, accumulate cost
      result = {
        ...continued,
        text: result.text + (continued.text ? "\n" + continued.text : ""),
        costUSD: result.costUSD + continued.costUSD,
        durationMs: result.durationMs + continued.durationMs,
      };
    }

    await progress.deleteStatusMsg();

    if (!result.text) {
      // No output — might be a silent failure, don't reset circuit breaker
      await platform
        .sendMessage(chatId, setupMsg(getLang()).noOutput)
        .catch(() => {});
      return;
    }

    // ── Resilience: check for system-level failure signals ──
    if (result.exitCode !== 0 || !result.gotResultEvent) {
      const reason = !result.gotResultEvent
        ? "no result event"
        : `exit code ${result.exitCode}`;
      const errClass = classifyError(result.exitCode, reason, false);
      if (errClass === "auth_error") {
        tripCircuit(botKey, reason);
        await platform.sendMessage(chatId, s.authError(botKey)).catch(() => {});
      } else {
        const tripped = recordFailure(botKey, reason);
        if (tripped) {
          await platform
            .sendMessage(
              chatId,
              s.circuitTripped(botKey, CIRCUIT_BREAKER_MAX_FAILURES),
            )
            .catch(() => {});
        }
      }
    } else {
      recordSuccess(botKey);
    }

    // ── Extract and send [[FILE:path]] markers ──
    const filePattern = /\[\[FILE:(\/[^\]]+)\]\]/g;
    const filePaths = [...result.text.matchAll(filePattern)].map((m) => m[1]);
    const cleanText = result.text.replace(filePattern, "").trim();

    if (filePaths.length > 0 && hasFileSupport(platform)) {
      for (const fp of filePaths) {
        try {
          if (existsSync(fp)) {
            await platform.sendFile(chatId, fp);
            log(`FILE: sent ${fp} to ${chatId}`);
          } else {
            log(`FILE: not found ${fp}`);
          }
        } catch (e) {
          log(`FILE: failed ${fp} — ${e}`);
        }
      }
    }

    const projectTag = project.replace(/[^a-zA-Z0-9\u4e00-\u9fff_]/g, "_");
    const mention = requesterName ? ` @${requesterName}` : "";
    const outputText = cleanText || result.text;
    const chunks = splitMessage(outputText, getMessageLimit());
    for (let i = 0; i < chunks.length; i++) {
      const text =
        i === chunks.length - 1
          ? `${chunks[i]}\n\n#${projectTag}${mention}`
          : chunks[i];
      await platform.sendMessage(chatId, text);
    }

    accumulateStats(managed, result);
    const ctxPct = result.contextWindow
      ? result.contextUsed / result.contextWindow
      : 0;
    log(
      `DONE: ${project} — ${result.text.length} chars, $${result.costUSD.toFixed(4)}, context ${result.contextWindow ? Math.round(ctxPct * 100) : "?"}%`,
    );

    // ── Auto-compact: prevent context overflow on next invocation ──
    if (ctxPct >= CONTEXT_AUTO_COMPACT_THRESHOLD && result.contextWindow) {
      log(
        `COMPACT: ${project} — context at ${Math.round(ctxPct * 100)}%, auto-compacting...`,
      );
      try {
        await runClaude(dir, "/compact", {
          resume: true,
          model: botModel,
        });
        log(`COMPACT: ${project} — done`);
      } catch (e) {
        log(`COMPACT: ${project} — failed: ${e}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`FAIL: ${project} — ${errMsg}`);

    // ── Resilience: error classification ──
    const errClass = classifyError(
      0, // no exit code in catch path
      errMsg,
      false,
    );

    switch (errClass) {
      case "auth_error":
        tripCircuit(botKey, errMsg);
        await platform.sendMessage(chatId, s.authError(botKey)).catch(() => {});
        break;
      case "rate_limit":
        await platform
          .sendMessage(
            chatId,
            s.adaptiveRateLimit(
              daemon.rateLimitInfo
                ? Math.ceil(getAdaptiveDelay(daemon.rateLimitInfo) / 1000)
                : 30,
            ),
          )
          .catch(() => {});
        break;
      default: {
        // Record failure for circuit breaker
        const tripped = recordFailure(botKey, errMsg);
        if (tripped) {
          await platform
            .sendMessage(
              chatId,
              s.circuitTripped(botKey, CIRCUIT_BREAKER_MAX_FAILURES),
            )
            .catch(() => {});
        } else {
          await platform
            .sendMessage(
              chatId,
              getLang() === "zh"
                ? `\u26a0\ufe0f 任务失败，请查看 daemon 日志`
                : `\u26a0\ufe0f Task failed. Check daemon logs for details.`,
            )
            .catch(() => {});
        }
      }
    }
  } finally {
    progress.cleanup();
    clearInterval(typingInterval);
    managed.busy = false;
    daemon.activeInvocations = Math.max(0, daemon.activeInvocations - 1);

    // Process next queued task — re-validate user access (skip for system tasks)
    // Set busy BEFORE dispatching to prevent concurrent message acceptance
    while (managed.queue.length > 0) {
      const next = managed.queue.shift()!;
      // Use live config for access check (user may have been added/removed since queued)
      const liveConf =
        loadPool().bots.find((b) => b.username === managed.config.username) ??
        managed.config;
      if (next.userId !== "system" && !canUseBot(next.userId, liveConf)) {
        log(`QUEUE: ${project} — skipped revoked user ${next.userId}`);
        continue;
      }
      managed.busy = true; // Set BEFORE dispatch to prevent concurrent acceptance
      log(
        `QUEUE: ${project} — processing next (${managed.queue.length} remaining)`,
      );
      void invokeClaudeAndReply(
        managed,
        next.chatId,
        next.message,
        next.imagePath,
        next.requesterName,
      );
      break;
    }
  }
}
