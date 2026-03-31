import { existsSync } from "fs";
import { randomBytes } from "crypto";
import { homedir } from "os";
import { join } from "path";
import type { ClaudeResult, ManagedBot } from "./types.js";
import {
  getConfig,
  loadPool,
  getAdmins,
  canUseBot,
  getBotAccessLevel,
  getBotPermissionMode,
  getBotModel,
  WRITE_TOOLS,
  READONLY_DISALLOWED,
  TYPING_INTERVAL_MS,
  PROGRESS_THROTTLE_MS,
  APPROVAL_TIMEOUT_MS,
  RESTART_NOTE_FILE,
  CONTEXT_WARN_THRESHOLD,
  CONTEXT_COMPACT_THRESHOLD,
  CONTEXT_WARN_COOLDOWN_MS,
} from "./config.js";
import { log } from "./logger.js";
import { getSafeEnv, formatToolLabel, splitMessage } from "./helpers.js";
import { daemon, sessionStats, pendingApprovals } from "./state.js";
import { getLang, setupMsg } from "./interactive/i18n.js";

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
  const steps: string[] = [];
  const startTime = Date.now();
  let lastProgressUpdate = 0;
  let pendingFlush: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const recent = steps.slice(-5);
    const text =
      `\u2699\ufe0f working... (${elapsed}s)\n` +
      recent.map((s) => `  \u2192 \ud83d\udd27 ${s}`).join("\n");
    if (statusMsgId) {
      void tgBot.editMessage(chatId, statusMsgId, text).catch(() => {});
    } else {
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
  const isDaemonProject = existsSync(join(dir, "src", "daemon.ts"));
  if (!isDaemonProject) return undefined;

  const safeProject = project.replace(/[^a-zA-Z0-9\u4e00-\u9fff _-]/g, "_");
  return `WARNING: You are running inside the telegram-pool daemon. If you modify daemon.ts or related files, you MUST: 1) finish ALL edits first, 2) send your reply/summary to the user, 3) write a restart note: echo '{"project":"${safeProject}","summary":"<what you did>"}' > ${RESTART_NOTE_FILE}, 4) ONLY THEN run daemon.sh restart as the very last command. Restarting kills your process — anything after it will not execute.`;
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
  const { config, platform } = managed;
  const project = config.assignedProject ?? config.username ?? "?";
  const dir = config.assignedPath ?? homedir();
  const mode = getBotPermissionMode(config);
  const botModel = getBotModel(config);
  const botEffort = managed.effort;
  const shouldContinue = !managed.skipContinue;
  managed.skipContinue = false; // reset after reading
  const cfg = getConfig();

  const s = setupMsg(getLang());
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
    const cleanMsg = userMessage.replace(/@\w+/g, "").trim();
    const prompt = imagePath
      ? `The user sent an image at path: ${imagePath}. Please use the Read tool to view the image first, then respond: ${cleanMsg || "Analyze this image"}`
      : cleanMsg;

    const systemPrompt = buildSystemPrompt(project, dir);
    const accessLevel = getBotAccessLevel(config);
    let result: ClaudeResult;

    if (accessLevel === "readOnly") {
      result = await runClaude(dir, prompt, {
        disallowedTools: READONLY_DISALLOWED,
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
        }
      }
    } else if (mode === "auto") {
      result = await runClaude(dir, prompt, {
        permissionMode: "auto",
        model: botModel,
        effort: botEffort,
        resume: shouldContinue,
        appendSystemPrompt: systemPrompt,
        onProgress: progress.onProgress,
      });
    } else {
      result = await runClaude(dir, prompt, {
        allowedTools: WRITE_TOOLS,
        model: botModel,
        effort: botEffort,
        resume: shouldContinue,
        appendSystemPrompt: systemPrompt,
        onProgress: progress.onProgress,
      });
    }

    await progress.deleteStatusMsg();

    if (!result.text) {
      await platform
        .sendMessage(chatId, setupMsg(getLang()).noOutput)
        .catch(() => {});
      return;
    }

    const projectTag = project.replace(/[^a-zA-Z0-9\u4e00-\u9fff_]/g, "_");
    const mention = requesterName ? ` @${requesterName}` : "";
    const chunks = splitMessage(result.text);
    for (let i = 0; i < chunks.length; i++) {
      const text =
        i === chunks.length - 1
          ? `${chunks[i]}\n\n#${projectTag}${mention}`
          : chunks[i];
      await platform.sendMessage(chatId, text);
    }

    accumulateStats(managed, result);
    log(
      `DONE: ${project} — ${result.text.length} chars, $${result.costUSD.toFixed(4)}, context ${result.contextWindow ? Math.round((result.contextUsed / result.contextWindow) * 100) : "?"}%`,
    );

    // Context usage warning
    if (result.contextWindow > 0) {
      const pct = result.contextUsed / result.contextWindow;
      const now = Date.now();
      const cooledDown =
        !managed.lastContextWarning ||
        now - managed.lastContextWarning > CONTEXT_WARN_COOLDOWN_MS;

      if (pct >= CONTEXT_COMPACT_THRESHOLD && cooledDown) {
        managed.lastContextWarning = now;
        const lang = getLang();
        await platform
          .sendMessage(
            chatId,
            lang === "zh"
              ? `🔄 @${config.username} 上下文已用 ${Math.round(pct * 100)}%，正在自动压缩...`
              : `🔄 @${config.username} context at ${Math.round(pct * 100)}%, auto-compacting...`,
          )
          .catch(() => {});
        // Silent compact — run Claude directly, don't send result to group
        runClaude(dir, "/compact", { resume: true })
          .then(async () => {
            await platform
              .sendMessage(
                chatId,
                lang === "zh"
                  ? `✅ @${config.username} 上下文已压缩`
                  : `✅ @${config.username} context compacted`,
              )
              .catch(() => {});
          })
          .catch(() => {});
      } else if (pct >= CONTEXT_WARN_THRESHOLD && cooledDown) {
        managed.lastContextWarning = now;
        const lang = getLang();
        const msg =
          lang === "zh"
            ? `⚠️ @${config.username} 上下文已用 ${Math.round(pct * 100)}%，建议 /new 重置或 /compact 压缩`
            : `⚠️ @${config.username} context at ${Math.round(pct * 100)}% — consider /new to reset or /compact to compress`;
        await platform.sendMessage(chatId, msg).catch(() => {});
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`FAIL: ${project} — ${msg}`);
    await platform
      .sendMessage(chatId, `\u26a0\ufe0f Failed: ${msg.slice(0, 200)}`)
      .catch(() => {});
  } finally {
    progress.cleanup();
    clearInterval(typingInterval);
    managed.busy = false;
    daemon.activeInvocations = Math.max(0, daemon.activeInvocations - 1);

    // Process next queued task — re-validate user access (skip for system tasks)
    while (managed.queue.length > 0) {
      const next = managed.queue.shift()!;
      if (next.userId !== "system" && !canUseBot(next.userId, config)) {
        log(`QUEUE: ${project} — skipped revoked user ${next.userId}`);
        continue;
      }
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
