#!/usr/bin/env bun
/**
 * Telegram Bot Pool Daemon v3
 *
 * Architecture: daemon polls all bots, routes messages, spawns `claude -p`
 * with --allowedTools for pre-authorized tool access. Real-time progress
 * via stream-json event parsing.
 *
 * Features:
 * - Pre-authorized tools (no permission prompts)
 * - Real-time progress feedback per turn
 * - Smart routing (keyword + Claude-based)
 * - Project status dashboard
 * - Cron scheduler
 * - Photo/voice support
 */

import { Bot, GrammyError, InlineKeyboard } from "grammy";
import type { ReactionTypeEmoji } from "grammy/types";
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  statSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";

// ── Config ──
const STATE_DIR =
  process.env.TELEGRAM_POOL_DIR ??
  join(homedir(), ".claude", "channels", "telegram");
const POOL_FILE = join(STATE_DIR, "bot-pool.json");
const LOG_FILE = join(STATE_DIR, "daemon.log");
const PID_FILE = join(STATE_DIR, "daemon.pid");
const CRON_FILE = join(STATE_DIR, "cron.json");
const DASHBOARD_FILE = join(STATE_DIR, "dashboard-msg.json");
const INBOX_DIR = join(STATE_DIR, "inbox");
const RESTART_NOTE_FILE = join(STATE_DIR, "restart-note.json");

// ── Constants ──
const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_RATE_LIMIT_S = 5;
const DEFAULT_SESSION_TIMEOUT_MIN = 10;
const DEFAULT_DASHBOARD_INTERVAL_MIN = 30;
const CRON_CHECK_INTERVAL_MS = 60_000; // 1 min
const MEMORY_CHECK_MS = 600_000; // 10 min
const TYPING_INTERVAL_MS = 4_000;
const PROGRESS_THROTTLE_MS = 2_000;
const APPROVAL_TIMEOUT_MS = 120_000; // 2 min
const BOT_START_STAGGER_MS = 2_000;
const POLL_RETRY_DELAY_MS = 15_000;
const DASHBOARD_INITIAL_DELAY_MS = 15_000;
const RESTART_NOTIFY_DELAY_MS = 16_000;
const LOG_MAX_BYTES = 500_000;
const LOG_RETAIN_BYTES = 250_000;
const LOG_ROTATE_INTERVAL = 200;
const CONTEXT_BAR_LENGTH = 10;
const WRITE_TOOLS = "Bash,Edit,Write,NotebookEdit,Agent,Skill";
const READONLY_DISALLOWED = "Bash,Edit,Write,NotebookEdit";

// Read config values (re-read from pool on each access so changes take effect)
function getConfig() {
  const pool = loadPool();
  return {
    maxConcurrent: pool.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
    rateLimitMs: (pool.rateLimitSeconds ?? DEFAULT_RATE_LIMIT_S) * 1000,
    sessionTimeoutMs:
      (pool.sessionTimeoutMinutes ?? DEFAULT_SESSION_TIMEOUT_MIN) * 60 * 1000,
    dashboardIntervalMs:
      (pool.dashboardIntervalMinutes ?? DEFAULT_DASHBOARD_INTERVAL_MIN) *
      60 *
      1000,
  };
}

// ── Auth: admins + per-bot members ──
function getAdmins(): string[] {
  const pool = loadPool();
  // admins list takes priority; fall back to ownerId for backward compat
  if (pool.admins && pool.admins.length > 0) return pool.admins;
  // backward compat: ownerId in bot-pool.json
  const ownerId = pool.ownerId ?? "";
  return ownerId ? [ownerId] : [];
}

function isAdmin(userId: string): boolean {
  return getAdmins().includes(userId);
}

function canUseBot(userId: string, botConfig: PoolBot): boolean {
  // Admins can use all bots
  if (isAdmin(userId)) return true;
  // Members: check per-bot allowedUsers
  return botConfig.allowedUsers?.includes(userId) ?? false;
}

function getBotAccessLevel(botConfig: PoolBot): "readWrite" | "readOnly" {
  return botConfig.accessLevel ?? loadPool().accessLevel ?? "readWrite";
}

function getBotPermissionMode(botConfig: PoolBot): "allowAll" | "approve" {
  // Only relevant when accessLevel is readWrite
  return botConfig.permissionMode ?? loadPool().permissionMode ?? "allowAll";
}

// Validate at startup
{
  const admins = getAdmins();
  if (admins.length === 0) {
    log("FATAL: no admins configured — set admins or ownerId in bot-pool.json");
    process.exit(1);
  }
  log(`Auth: ${admins.length} admin(s): ${admins.join(", ")}`);
}

// ── Types ──
type PoolBot = {
  token: string;
  username?: string;
  role?: "master" | "project";
  assignedProject?: string;
  assignedPath?: string;
  accessLevel?: "readWrite" | "readOnly"; // per-bot override, default: readWrite
  permissionMode?: "allowAll" | "approve"; // per-bot override (only when readWrite)
  allowedUsers?: string[]; // member user IDs who can use this bot
};
type BotPool = {
  bots: PoolBot[];
  sharedGroupId?: string;
  admins?: string[]; // admin user IDs, can use ALL bots
  ownerId?: string; // backward compat — treated as single admin
  accessLevel?: "readWrite" | "readOnly"; // global default: "readWrite"
  permissionMode?: "allowAll" | "approve"; // global default: "allowAll" (only when readWrite)
  memoryIntervalMinutes?: number; // 0 = disabled, default: 120 (2h)
  masterExecute?: boolean; // allow master bot to run Claude tasks, default: false
  maxConcurrent?: number; // max parallel Claude invocations, default: 3
  rateLimitSeconds?: number; // min gap between invocations per bot, default: 5
  sessionTimeoutMinutes?: number; // Claude invocation timeout, default: 10
  dashboardIntervalMinutes?: number; // dashboard auto-refresh, default: 30
  whisperLanguage?: string; // Whisper language code, empty = auto-detect
};
type ManagedBot = {
  config: PoolBot;
  bot: Bot;
  busy: boolean;
  lastInvoke: number;
  lastActivity: number;
  lastMemorySave: number;
  // Context tracking (from latest invocation)
  contextUsed: number;
  contextWindow: number;
  lastModel: string;
  lastCostUSD: number;
};
type CronJob = {
  id: string;
  botUsername: string;
  schedule: string;
  prompt: string;
  lastRun?: string;
  enabled: boolean;
};

// ── State ──
const managedBots = new Map<string, ManagedBot>();
const botByUsername = new Map<string, ManagedBot>();
let activeInvocations = 0;
let masterBot: ManagedBot | null = null;

// ── Logging ──
let logWriteCount = 0;
function log(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    appendFileSync(LOG_FILE, line);
    // Rotate every 200 writes instead of statSync every call
    if (++logWriteCount >= LOG_ROTATE_INTERVAL) {
      logWriteCount = 0;
      try {
        if (statSync(LOG_FILE).size > LOG_MAX_BYTES) {
          const tail = readFileSync(LOG_FILE, "utf8").slice(-LOG_RETAIN_BYTES);
          writeFileSync(LOG_FILE, tail);
        }
      } catch {}
    }
  } catch {
    process.stderr.write(line);
  }
}

// ── Pool ──
function loadPool(): BotPool {
  try {
    return JSON.parse(readFileSync(POOL_FILE, "utf8")) as BotPool;
  } catch {
    return { bots: [] };
  }
}

// ── Cron ──
function loadCron(): CronJob[] {
  try {
    return JSON.parse(readFileSync(CRON_FILE, "utf8")) as CronJob[];
  } catch {
    return [];
  }
}
function saveCron(jobs: CronJob[]): void {
  writeFileSync(CRON_FILE, JSON.stringify(jobs, null, 2) + "\n", {
    mode: 0o600,
  });
}

// ── Git helpers ──
function gitInfo(
  dir: string,
): { branch: string; lastCommit: string; lastCommitAge: string } | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dir,
      timeout: 5000,
    })
      .toString()
      .trim();
    const gitLog = execSync('git log -1 --format="%s|||%cr"', {
      cwd: dir,
      timeout: 5000,
    })
      .toString()
      .trim();
    const [lastCommit, lastCommitAge] = gitLog.split("|||");
    return {
      branch,
      lastCommit: lastCommit ?? "",
      lastCommitAge: lastCommitAge ?? "",
    };
  } catch {
    return null;
  }
}

// ── Stats formatting ──
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

// ── Tool label for progress display ──
function formatToolLabel(name: string, input: Record<string, any>): string {
  const file = (input.file_path ?? "").split("/").pop() ?? "";
  switch (name) {
    case "Bash":
      return `Bash: ${(input.command ?? "").slice(0, 50)}`;
    case "Read":
    case "Edit":
    case "Write":
      return `${name}: ${file}`;
    case "Grep":
      return `Grep: ${input.pattern ?? ""}`;
    case "Glob":
      return `Glob: ${input.pattern ?? ""}`;
    default:
      return name;
  }
}

// ── Telegram message splitting ──
function splitMessage(text: string, limit = 4096): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  return chunks;
}

// ── Download photo ──
async function downloadPhoto(
  botApi: Bot["api"],
  token: string,
  fileId: string,
): Promise<string | undefined> {
  try {
    mkdirSync(INBOX_DIR, { recursive: true });
    const file = await botApi.getFile(fileId);
    if (!file.file_path) return undefined;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = file.file_path.split(".").pop() ?? "jpg";
    const path = join(INBOX_DIR, `${Date.now()}.${ext}`);
    writeFileSync(path, buf);
    return path;
  } catch {
    return undefined;
  }
}

// ── Download and transcribe voice ──
async function transcribeVoice(
  botApi: Bot["api"],
  token: string,
  fileId: string,
): Promise<{ path: string; text: string } | undefined> {
  try {
    mkdirSync(INBOX_DIR, { recursive: true });
    const file = await botApi.getFile(fileId);
    if (!file.file_path) return undefined;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const oggPath = join(INBOX_DIR, `${Date.now()}.ogg`);
    writeFileSync(oggPath, buf);

    const wavPath = oggPath.replace(".ogg", ".wav");
    try {
      execSync(
        `ffmpeg -y -i "${oggPath}" -ar 16000 -ac 1 "${wavPath}" 2>/dev/null`,
        { timeout: 15000 },
      );
    } catch {
      return { path: oggPath, text: "" };
    }

    try {
      execSync(
        `whisper "${wavPath}" --model turbo ${loadPool().whisperLanguage ? `--language ${loadPool().whisperLanguage}` : ""} --output_format txt --output_dir "${INBOX_DIR}" 2>/dev/null`,
        { timeout: 60000 },
      );
      const txtPath = wavPath.replace(".wav", ".txt");
      const text = existsSync(txtPath)
        ? readFileSync(txtPath, "utf8").trim()
        : "";
      try {
        unlinkSync(oggPath);
        unlinkSync(wavPath);
        unlinkSync(txtPath);
      } catch {}
      return { path: wavPath, text };
    } catch (err) {
      log(`WHISPER_ERROR: ${err}`);
      return { path: oggPath, text: "" };
    }
  } catch {
    return undefined;
  }
}

// ── Safe environment for Claude subprocesses ──
const SENSITIVE_ENV_PATTERNS = [
  "TELEGRAM_",
  "BOT_",
  "ANTHROPIC_API",
  "OPENAI_API",
  "AWS_SECRET",
  "AWS_SESSION",
  "GITHUB_TOKEN",
  "NPM_TOKEN",
  "DOCKER_PASSWORD",
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "REDIS_URL",
  "STRIPE_",
  "_SECRET",
  "_TOKEN",
  "_PASSWORD",
  "_KEY",
];

function getSafeEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => {
      const upper = k.toUpperCase();
      // Keep PATH, HOME, SHELL, LANG, USER, TERM and other system vars
      // Block anything matching sensitive patterns
      return !SENSITIVE_ENV_PATTERNS.some(
        (pat) =>
          upper.includes(pat) &&
          ![
            "PATH",
            "HOME",
            "SHELL",
            "LANG",
            "USER",
            "TERM",
            "TMPDIR",
            "XDG_",
          ].some((safe) => upper.startsWith(safe)),
      );
    }),
  ) as Record<string, string>;
}

// ══════════════════════════════════════
// ── Core: run Claude and parse stream ──
// ══════════════════════════════════════
type ClaudeResult = {
  text: string;
  permissionDenials: string[];
  costUSD: number;
  durationMs: number;
  numTurns: number;
  tokensByModel: Record<string, number>;
  contextUsed: number; // total tokens in context
  contextWindow: number; // max context window
  model: string;
};

// ── Session stats (in-memory, reset on daemon restart) ──
type SessionStats = {
  totalCostUSD: number;
  totalDurationMs: number;
  totalInvocations: number;
  tokensByModel: Record<string, number>;
};
const sessionStats: SessionStats = {
  totalCostUSD: 0,
  totalDurationMs: 0,
  totalInvocations: 0,
  tokensByModel: {},
};

// Rate limit info from latest Claude invocation
let rateLimitInfo: {
  resetsAt: number;
  rateLimitType: string;
  status: string;
} | null = null;

async function runClaude(
  dir: string,
  prompt: string,
  opts: {
    allowedTools?: string;
    disallowedTools?: string;
    appendSystemPrompt?: string;
    onProgress?: (label: string) => void;
  } = {},
): Promise<ClaudeResult> {
  const cmd = [
    "claude",
    "-p",
    "--continue",
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

        let event: any;
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
          permissionDenials = (event.permission_denials ?? []).map((d: any) =>
            typeof d === "string"
              ? d
              : (d.tool_name ?? d.tool ?? d.name ?? "?"),
          );
          costUSD = event.total_cost_usd ?? 0;
          durationMs = event.duration_ms ?? 0;
          numTurns = event.num_turns ?? 0;
          // Extract per-model token counts + context info
          const mu = event.modelUsage ?? {};
          for (const [m, info] of Object.entries(mu) as any) {
            const total =
              (info.inputTokens ?? 0) +
              (info.outputTokens ?? 0) +
              (info.cacheReadInputTokens ?? 0) +
              (info.cacheCreationInputTokens ?? 0);
            tokensByModel[m] = total;
            // Use the first model's context window
            if (!contextWindow && info.contextWindow) {
              contextWindow = info.contextWindow;
              model = m;
            }
          }
          // Total context = all input + output tokens
          const u = event.usage ?? {};
          contextUsed =
            (u.input_tokens ?? 0) +
            (u.output_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0);
        }

        // Rate limit event
        if (event.type === "rate_limit_event" && event.rate_limit_info) {
          rateLimitInfo = {
            resetsAt: event.rate_limit_info.resetsAt ?? 0,
            rateLimitType: event.rate_limit_info.rateLimitType ?? "",
            status: event.rate_limit_info.status ?? "",
          };
        }

        // Tool use → progress callback
        if (
          opts.onProgress &&
          event.type === "assistant" &&
          event.message?.content
        ) {
          for (const block of event.message.content) {
            if (block.type !== "tool_use") continue;
            opts.onProgress(
              formatToolLabel(block.name ?? "", block.input ?? {}),
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

// ── Pending approval state for approve mode ──
const pendingApprovals = new Map<
  string,
  { resolve: (tools: string | null) => void }
>();

// ══════════════════════════════════════
// ── Core: invoke Claude and reply ──
// ══════════════════════════════════════
async function invokeClaudeAndReply(
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
    await tgBot.api.sendMessage(chatId, `⏳ 请稍等几秒再试`).catch(() => {});
    return;
  }
  if (activeInvocations >= cfg.maxConcurrent) {
    await tgBot.api
      .sendMessage(
        chatId,
        `⏳ ${activeInvocations}/${cfg.maxConcurrent} 任务执行中，请稍后`,
      )
      .catch(() => {});
    return;
  }

  managed.busy = true;
  managed.lastInvoke = Date.now();
  activeInvocations++;

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
      `⚙️ working... (${elapsed}s)\n` +
      recent.map((s) => `  → 🔧 ${s}`).join("\n");
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
      ? `用户发送了一张图片，路径: ${imagePath}。请先用 Read 工具查看这张图片，然后回答: ${cleanMsg || "分析这张图片"}`
      : cleanMsg;

    const isDaemonProject = existsSync(join(dir, "src", "daemon.ts"));
    const safeProject = project.replace(/['"\\]/g, "_");
    const restartNotePath = RESTART_NOTE_FILE;
    const systemPrompt = isDaemonProject
      ? `WARNING: You are running inside the telegram-pool daemon. If you modify daemon.ts or related files, you MUST: 1) finish ALL edits first, 2) send your reply/summary to the user, 3) write a restart note: echo '{"project":"${safeProject}","summary":"<what you did>"}' > ${restartNotePath}, 4) ONLY THEN run daemon.sh restart as the very last command. Restarting kills your process — anything after it will not execute.`
      : undefined;

    // WRITE_TOOLS defined at module level
    const accessLevel = getBotAccessLevel(config);
    let result: ClaudeResult;

    if (accessLevel === "readOnly") {
      // ── ReadOnly: hard-restrict to read-only tools via --disallowedTools ──
      result = await runClaude(dir, prompt, {
        disallowedTools: READONLY_DISALLOWED,
        appendSystemPrompt:
          (systemPrompt ? systemPrompt + "\n\n" : "") +
          "You are in read-only mode. You cannot edit, write, or create files. Only read, search, and analyze.",
        onProgress,
      });
    } else if (mode === "approve") {
      // ── ReadWrite + Approve: first run without write tools, then ask ──
      result = await runClaude(dir, prompt, {
        appendSystemPrompt: systemPrompt,
        onProgress,
      });

      // If tools were denied, ask user for approval
      if (result.permissionDenials.length > 0) {
        const denied = [...new Set(result.permissionDenials)];
        log(`APPROVE: denied tools: ${denied.join(", ")}`);

        const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const toolList = denied.map((t) => `  • ${t}`).join("\n");
        const keyboard = new InlineKeyboard()
          .text("✅ 允许并重试", `approve:yes:${approvalId}`)
          .text("❌ 不需要", `approve:no:${approvalId}`);

        await tgBot.api
          .sendMessage(
            chatId,
            `🔒 Claude 需要以下工具权限:\n${toolList}\n\n允许后将重新执行`,
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
          result = await runClaude(
            dir,
            "请继续完成刚才的任务，需要的工具已经被授权了。",
            {
              allowedTools: approved,
              appendSystemPrompt: systemPrompt,
              onProgress,
            },
          );
        }
      }
    } else {
      // ── ReadWrite + AllowAll: pre-authorize everything ──
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
      await tgBot.api.sendMessage(chatId, "(无输出)").catch(() => {});
      return;
    }

    for (const chunk of splitMessage(result.text)) {
      await tgBot.api.sendMessage(chatId, chunk);
    }
    // Accumulate session stats
    sessionStats.totalCostUSD += result.costUSD;
    sessionStats.totalDurationMs += result.durationMs;
    sessionStats.totalInvocations++;
    for (const [model, tokens] of Object.entries(result.tokensByModel)) {
      sessionStats.tokensByModel[model] =
        (sessionStats.tokensByModel[model] ?? 0) + tokens;
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
      .sendMessage(chatId, `⚠️ 失败: ${msg.slice(0, 200)}`)
      .catch(() => {});
  } finally {
    if (pendingProgressFlush) clearTimeout(pendingProgressFlush);
    clearInterval(typingInterval);
    managed.busy = false;
    activeInvocations = Math.max(0, activeInvocations - 1);
  }
}

// ══════════════════════════════════════
// ── Dashboard ──
// ══════════════════════════════════════
async function updateDashboard(): Promise<void> {
  if (!masterBot) {
    log("DASHBOARD: no masterBot");
    return;
  }
  const pool = loadPool();
  if (!pool.sharedGroupId) {
    log("DASHBOARD: no sharedGroupId");
    return;
  }
  log("DASHBOARD: updating...");

  const now = new Date();
  const timeStr = now.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

  let text = `📊 项目看板 · ${timeStr}\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const b of pool.bots) {
    if (b.role === "master") continue;
    if (!b.assignedPath) continue;

    const git = gitInfo(b.assignedPath);
    const botLabel = b.username ? `@${b.username}` : "?";
    const managed = botByUsername.get(b.username ?? "");
    const busyFlag = managed?.busy ? " 🔄" : "";

    text += `📂 ${b.assignedProject}${busyFlag}\n`;
    if (git) {
      text += `   🌿 ${git.branch} · ${git.lastCommitAge}\n`;
      text += `   💬 ${git.lastCommit.slice(0, 50)}\n`;
    }
    // Context usage bar
    if (managed && managed.contextWindow > 0) {
      const pct = Math.round(
        (managed.contextUsed / managed.contextWindow) * 100,
      );
      const barLen = CONTEXT_BAR_LENGTH;
      const filled = Math.round((pct / 100) * barLen);
      const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
      const modelShort = managed.lastModel
        .replace("claude-", "")
        .replace(/\[.*$/, "");
      text += `   📊 [${modelShort}] ${bar} ${pct}%`;
      if (managed.lastCostUSD > 0)
        text += ` · ${formatCost(managed.lastCostUSD)}`;
      text += `\n`;
    }
    text += `   🤖 ${botLabel}\n\n`;
  }

  // Session stats (since daemon started)
  if (sessionStats.totalInvocations > 0) {
    const tokenLines = Object.entries(sessionStats.tokensByModel)
      .map(([model, count]) => {
        const short = model.replace("claude-", "").replace(/\[.*$/, "");
        return `${short}: ${formatTokens(count)}`;
      })
      .join(" | ");

    text += `📈 本次运行\n`;
    text += `   调用: ${sessionStats.totalInvocations} | 耗时: ${formatDuration(sessionStats.totalDurationMs)} | 费用: ${formatCost(sessionStats.totalCostUSD)}\n`;
    if (tokenLines) text += `   ${tokenLines}\n`;
  } else {
    text += `📈 本次运行: 暂无调用\n`;
  }

  // Rate limit info
  if (rateLimitInfo && rateLimitInfo.resetsAt > 0) {
    const resetDate = new Date(rateLimitInfo.resetsAt * 1000);
    const diffMs = resetDate.getTime() - Date.now();
    const diffMin = Math.max(0, Math.round(diffMs / 60_000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    const resetStr = h > 0 ? `${h}h${m}m` : `${m}m`;
    text += `\n⏱ 额度重置: ${resetStr} 后 (${rateLimitInfo.rateLimitType})`;
  }

  try {
    // Delete old dashboard message
    let dashMsg: { messageId: number; chatId: string } | null = null;
    try {
      dashMsg = JSON.parse(readFileSync(DASHBOARD_FILE, "utf8"));
    } catch {}

    if (dashMsg && dashMsg.chatId === pool.sharedGroupId) {
      await masterBot.bot.api
        .deleteMessage(pool.sharedGroupId, dashMsg.messageId)
        .catch(() => {});
    }

    // Send new and pin
    const sent = await masterBot.bot.api.sendMessage(pool.sharedGroupId, text);
    writeFileSync(
      DASHBOARD_FILE,
      JSON.stringify({
        messageId: sent.message_id,
        chatId: pool.sharedGroupId,
      }),
    );
    await masterBot.bot.api
      .pinChatMessage(pool.sharedGroupId, sent.message_id, {
        disable_notification: true,
      })
      .catch(() => {});
    log(`DASHBOARD: posted and pinned`);
  } catch (err) {
    log(`DASHBOARD_ERROR: ${err}`);
  }
}

// ══════════════════════════════════════
// ── Cron ──
// ══════════════════════════════════════
async function checkCron(): Promise<void> {
  const jobs = loadCron();
  if (jobs.length === 0) return;

  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayStr = now.toISOString().split("T")[0];
  let changed = false;

  for (const job of jobs) {
    if (!job.enabled) continue;
    let shouldRun = false;

    if (job.schedule.includes(":")) {
      if (nowHHMM === job.schedule && job.lastRun?.split("T")[0] !== todayStr) {
        shouldRun = true;
      }
    } else if (job.schedule.startsWith("*/")) {
      const intervalMin = parseInt(job.schedule.slice(2), 10);
      if (!intervalMin) continue;
      const lastRunTime = job.lastRun ? new Date(job.lastRun).getTime() : 0;
      if (now.getTime() - lastRunTime >= intervalMin * 60 * 1000) {
        shouldRun = true;
      }
    }

    if (!shouldRun) continue;

    const managed = botByUsername.get(job.botUsername);
    if (!managed) {
      log(`CRON: ${job.id} — bot @${job.botUsername} not found`);
      continue;
    }
    if (managed.busy) {
      log(`CRON: ${job.id} — @${job.botUsername} busy, skip`);
      continue;
    }

    const pool = loadPool();
    const chatId = pool.sharedGroupId;
    if (!chatId) continue;

    log(
      `CRON: ${job.id} — running "${job.prompt.slice(0, 50)}" on @${job.botUsername}`,
    );

    job.lastRun = now.toISOString();
    changed = true;

    invokeClaudeAndReply(managed, chatId, job.prompt).catch((err) => {
      log(`CRON_FAIL: ${job.id} — ${err}`);
    });
  }

  if (changed) saveCron(jobs);
}

// ══════════════════════════════════════
// ── Memory: periodic save for active projects ──
// ══════════════════════════════════════
async function checkMemory(): Promise<void> {
  const pool = loadPool();
  const intervalMin = pool.memoryIntervalMinutes ?? 120;
  if (intervalMin <= 0) return; // disabled

  const chatId = pool.sharedGroupId;
  const now = Date.now();
  const intervalMs = intervalMin * 60 * 1000;
  const saving: string[] = [];

  for (const [, managed] of managedBots) {
    const { config } = managed;
    if (config.role === "master" || !config.assignedPath) continue;
    if (managed.busy) continue;

    // Skip if no activity since last memory save
    if (managed.lastActivity <= managed.lastMemorySave) continue;

    // Skip if not enough time passed since last save
    if (managed.lastMemorySave > 0 && now - managed.lastMemorySave < intervalMs)
      continue;

    // Skip if last activity was too long ago (stale)
    if (now - managed.lastActivity > intervalMs) continue;

    const project = config.assignedProject ?? "?";
    log(`MEMORY: saving for ${project}`);
    managed.lastMemorySave = now;
    saving.push(project);

    // Run claude -p to save memory (fire and forget)
    const proc = Bun.spawn({
      cmd: [
        "claude",
        "-p",
        "--continue",
        "--output-format",
        "text",
        "请回顾本次会话的关键内容，将重要的决策、变更和待办事项保存到项目的 memory 中（使用 auto memory 机制）。只保存有价值的信息，不要保存琐碎的细节。完成后简短说明保存了什么。",
        "--allowedTools",
        "Bash,Edit,Write,Read,Glob,Grep",
      ],
      cwd: config.assignedPath,
      env: getSafeEnv(),
      stdout: "pipe",
      stderr: "ignore",
    });

    // Don't block — just log result when done
    new Response(proc.stdout)
      .text()
      .then((text) => {
        const summary = text.trim().slice(0, 200);
        log(`MEMORY: ${project} — ${summary || "(no output)"}`);
      })
      .catch(() => {});
  }

  // Notify via master bot
  if (saving.length > 0 && masterBot && chatId) {
    await masterBot.bot.api
      .sendMessage(chatId, `🧠 定时记忆: ${saving.join(", ")}`)
      .catch(() => {});
  }
}

// ══════════════════════════════════════
// ── Master bot: direct commands ──
// ══════════════════════════════════════
function handleMasterCommand(stripped: string): string | null | undefined {
  if (/^help$/i.test(stripped)) {
    const pool = loadPool();
    const projectBots = pool.bots.filter((b) => b.role !== "master");
    return (
      `🤖 Bot 池管理系统 v3\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 ${projectBots.filter((b) => b.assignedProject).length} 个项目在线\n\n` +
      `🏠 主控 Bot\n` +
      `  • help — 本帮助\n` +
      `  • status — 刷新项目看板\n` +
      `  • cron list / add / del\n` +
      `  • search 关键词 — 搜索所有项目\n\n` +
      `📂 项目 Bot\n` +
      `  • @bot 你的需求\n` +
      `  • 回复 bot 消息继续对话\n\n` +
      `🟢 项目:\n` +
      projectBots
        .filter((b) => b.assignedProject)
        .map((b) => `  • ${b.assignedProject} (@${b.username ?? "?"})`)
        .join("\n")
    );
  }

  if (/^status$/i.test(stripped)) {
    updateDashboard();
    return null;
  }

  if (/^cron\s+list$/i.test(stripped)) {
    const jobs = loadCron();
    if (jobs.length === 0)
      return "📋 暂无定时任务\n\n用法: cron add @bot HH:MM 任务描述";
    return (
      "📋 定时任务\n━━━━━━━━━━━━━━━\n\n" +
      jobs
        .map((j) => {
          const status = j.enabled ? "🟢" : "⏸";
          const last = j.lastRun ? j.lastRun.split("T")[0] : "从未";
          return `${status} [${j.id}] @${j.botUsername} ${j.schedule}\n   ${j.prompt.slice(0, 60)}\n   上次: ${last}`;
        })
        .join("\n\n")
    );
  }

  const cronAddMatch = stripped.match(
    /^cron\s+add\s+@(\w+)\s+(\d{1,2}:\d{2}|\*\/\d+)\s+(.+)$/i,
  );
  if (cronAddMatch) {
    const [, botUser, schedule, prompt] = cronAddMatch;
    const jobs = loadCron();
    const id = `job-${Date.now().toString(36)}`;
    jobs.push({
      id,
      botUsername: botUser!,
      schedule: schedule!,
      prompt: prompt!,
      enabled: true,
    });
    saveCron(jobs);
    return `✅ 定时任务已创建\n  ID: ${id}\n  Bot: @${botUser}\n  时间: ${schedule}\n  任务: ${prompt}`;
  }

  const cronDelMatch = stripped.match(/^cron\s+del\s+(\S+)$/i);
  if (cronDelMatch) {
    const jobs = loadCron();
    const before = jobs.length;
    const filtered = jobs.filter((j) => j.id !== cronDelMatch[1]);
    if (filtered.length === before) return `⚠️ 未找到任务: ${cronDelMatch[1]}`;
    saveCron(filtered);
    return `✅ 已删除任务: ${cronDelMatch[1]}`;
  }

  const searchMatch = stripped.match(/^search\s+(.+)$/i);
  if (searchMatch) {
    const keyword = searchMatch[1]!;
    // Sanitize: only allow word chars, spaces, dots, hyphens, underscores
    const safeKeyword = keyword.replace(/[^\w\s.\-]/g, "");
    if (!safeKeyword) return `⚠️ 无效的搜索关键词`;
    const pool = loadPool();
    const results: string[] = [];
    for (const b of pool.bots) {
      if (!b.assignedPath) continue;
      try {
        const out = execSync(
          `grep -rFl --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.json" --include="*.md" -- "${safeKeyword}" . 2>/dev/null | head -10`,
          { cwd: b.assignedPath, timeout: 10000 },
        )
          .toString()
          .trim();
        if (out) {
          results.push(
            `📂 ${b.assignedProject}:\n${out
              .split("\n")
              .map((f) => `  ${f}`)
              .join("\n")}`,
          );
        }
      } catch {}
    }
    if (results.length === 0) return `🔍 "${keyword}" — 未找到匹配`;
    return `🔍 "${keyword}" 搜索结果:\n━━━━━━━━━━━━━━━\n\n${results.join("\n\n")}`;
  }

  return undefined; // not a built-in command
}

// ══════════════════════════════════════
// ── Bot setup ──
// ══════════════════════════════════════
function setupBot(managed: ManagedBot): void {
  const { bot: tgBot, config } = managed;
  const botName = config.username ?? "";

  tgBot.use((ctx, next) => {
    const from = ctx.from;
    const text = ctx.message?.text ?? ctx.message?.caption ?? "";
    if (ctx.message) {
      const userId = String(from?.id ?? "");
      const authorized = canUseBot(userId, config);
      log(
        `RAW: @${botName} ← [${ctx.chat?.type}] ${from?.username ?? "?"}(${userId}) auth=${authorized}: ${text.slice(0, 60)}`,
      );
    }
    return next();
  });

  // Approval callback handler (approve mode)
  tgBot.on("callback_query:data", async (ctx) => {
    if (!ctx.from || !isAdmin(String(ctx.from.id))) {
      await ctx.answerCallbackQuery({ text: "⛔ 仅管理员可操作" });
      return;
    }
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("approve:")) return;

    const [, action, approvalId] = data.split(":");
    const pending = pendingApprovals.get(approvalId!);
    if (!pending) {
      await ctx.answerCallbackQuery({ text: "⏰ 已过期" });
      return;
    }

    pendingApprovals.delete(approvalId!);
    const approved = action === "yes";
    pending.resolve(approved ? WRITE_TOOLS : null);

    const label = approved ? "✅ 已授权，重新执行中..." : "❌ 已跳过";
    await ctx.answerCallbackQuery({ text: label });
    const msg = ctx.callbackQuery.message;
    if (msg && "text" in msg && msg.text) {
      await ctx
        .editMessageText(`${msg.text}\n\n${label}`, {
          reply_markup: { inline_keyboard: [] },
        })
        .catch(() => {});
    }
  });

  // Photo handler
  tgBot.on("message:photo", async (ctx) => {
    if (!ctx.from || !canUseBot(String(ctx.from.id), config)) return;
    const text = ctx.message.caption ?? "";
    const chatType = ctx.chat?.type;
    const chatId = String(ctx.chat!.id);

    if (chatType === "group" || chatType === "supergroup") {
      const entities = ctx.message.caption_entities ?? [];
      const isMentioned = entities.some((e) => {
        if (e.type !== "mention") return false;
        const mentioned = text.slice(e.offset, e.offset + e.length);
        return mentioned.toLowerCase() === `@${botName}`.toLowerCase();
      });
      const isReplyToMe =
        ctx.message.reply_to_message?.from?.username?.toLowerCase() ===
        botName.toLowerCase();
      if (!isMentioned && !isReplyToMe) return;
    }

    if (managed.busy) {
      await ctx.reply("⏳ 正在处理上一条消息...").catch(() => {});
      return;
    }

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const imagePath = await downloadPhoto(
      tgBot.api,
      config.token,
      best.file_id,
    );

    void tgBot.api
      .setMessageReaction(chatId, ctx.message.message_id, [
        { type: "emoji", emoji: "👀" as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});

    void invokeClaudeAndReply(managed, chatId, text, imagePath);
  });

  // Voice handler
  tgBot.on("message:voice", async (ctx) => {
    if (!ctx.from || !canUseBot(String(ctx.from.id), config)) return;
    const chatType = ctx.chat?.type;
    const chatId = String(ctx.chat!.id);

    if (chatType === "group" || chatType === "supergroup") {
      const replyTo = ctx.message.reply_to_message;
      if (
        !replyTo ||
        replyTo.from?.username?.toLowerCase() !== botName.toLowerCase()
      )
        return;
    }

    if (managed.busy) {
      await ctx.reply("⏳ 正在处理上一条消息...").catch(() => {});
      return;
    }

    void tgBot.api
      .setMessageReaction(chatId, ctx.message.message_id, [
        { type: "emoji", emoji: "🎧" as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});

    const statusMsg = await tgBot.api
      .sendMessage(chatId, "🎤 正在识别语音...")
      .catch(() => null);

    const result = await transcribeVoice(
      tgBot.api,
      config.token,
      ctx.message.voice.file_id,
    );
    if (!result || !result.text) {
      if (statusMsg) {
        await tgBot.api
          .editMessageText(chatId, statusMsg.message_id, "⚠️ 语音识别失败")
          .catch(() => {});
      }
      return;
    }

    if (statusMsg) {
      await tgBot.api
        .editMessageText(
          chatId,
          statusMsg.message_id,
          `🎤 识别结果: ${result.text}`,
        )
        .catch(() => {});
    }

    void invokeClaudeAndReply(managed, chatId, result.text);
  });

  // Text handler
  tgBot.on("message:text", async (ctx) => {
    if (!ctx.from || !canUseBot(String(ctx.from.id), config)) return;

    const text = ctx.message.text;
    const chatType = ctx.chat?.type;
    const chatId = String(ctx.chat!.id);
    const msgId = ctx.message.message_id;

    // Group: check @mention, reply, or smart routing
    if (chatType === "group" || chatType === "supergroup") {
      const entities = ctx.message.entities ?? [];
      const isMentioned = entities.some((e) => {
        if (e.type !== "mention") return false;
        const mentioned = text.slice(e.offset, e.offset + e.length);
        return mentioned.toLowerCase() === `@${botName}`.toLowerCase();
      });
      const isReplyToMe =
        ctx.message.reply_to_message?.from?.username?.toLowerCase() ===
        botName.toLowerCase();

      if (!isMentioned && !isReplyToMe) return;
    }

    // Master bot: direct commands
    if (config.role === "master") {
      const stripped = text.replace(/@\w+/g, "").trim();
      const directReply = handleMasterCommand(stripped);
      if (directReply !== undefined) {
        if (directReply !== null) {
          for (const chunk of splitMessage(directReply)) {
            await tgBot.api.sendMessage(chatId, chunk).catch(() => {});
          }
        }
        return;
      }
    }

    if (config.role === "master" && !loadPool().masterExecute) {
      // masterExecute disabled — master only handles built-in commands
      return;
    }

    if (!config.assignedPath) {
      await ctx.reply(`⚠️ @${botName} 尚未绑定项目`).catch(() => {});
      return;
    }

    if (managed.busy) {
      await ctx.reply("⏳ 正在处理上一条消息...").catch(() => {});
      return;
    }

    // Ack
    void tgBot.api
      .setMessageReaction(chatId, msgId, [
        { type: "emoji", emoji: "👀" as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});

    // Include quoted message content if replying to a message
    let fullText = text;
    let quotedImagePath: string | undefined;
    const replyMsg = ctx.message.reply_to_message as any;
    if (replyMsg) {
      const quotedText = replyMsg.text ?? replyMsg.caption ?? "";
      const parts: string[] = [];

      if (quotedText) parts.push(`文字: ${quotedText}`);

      // Quoted photo
      if (replyMsg.photo?.length) {
        const best = replyMsg.photo[replyMsg.photo.length - 1];
        quotedImagePath = await downloadPhoto(
          tgBot.api,
          config.token,
          best.file_id,
        );
        if (quotedImagePath) parts.push(`图片: ${quotedImagePath}`);
      }

      // Quoted document/file
      if (replyMsg.document) {
        parts.push(
          `文件: ${replyMsg.document.file_name ?? "未知"} (${replyMsg.document.mime_type ?? ""})`,
        );
      }

      // Quoted voice
      if (replyMsg.voice) {
        const voiceResult = await transcribeVoice(
          tgBot.api,
          config.token,
          replyMsg.voice.file_id,
        );
        if (voiceResult?.text) parts.push(`语音内容: ${voiceResult.text}`);
      }

      // Quoted video note / sticker
      if (replyMsg.video_note) parts.push(`[视频消息]`);
      if (replyMsg.sticker)
        parts.push(`[贴纸: ${replyMsg.sticker.emoji ?? ""}]`);

      if (parts.length > 0) {
        fullText = `[引用消息]\n${parts.join("\n")}\n\n${text}`;
      }
    }

    void invokeClaudeAndReply(managed, chatId, fullText, quotedImagePath);
  });

  tgBot.catch((err) => {
    log(`BOT_ERROR: ${config.username ?? "?"} — ${err.error}`);
  });
}

// ══════════════════════════════════════
// ── Main ──
// ══════════════════════════════════════
async function main(): Promise<void> {
  // PID file is managed by watchdog.sh — don't overwrite it here
  mkdirSync(INBOX_DIR, { recursive: true });

  const pool = loadPool();
  if (pool.bots.length === 0) {
    log("FATAL: bot pool is empty — run manage-pool.sh add");
    process.exit(1);
  }

  const hasMaster = pool.bots.some((b) => b.role === "master");
  if (!hasMaster) {
    log("FATAL: no master bot — run manage-pool.sh add <token> --master");
    process.exit(1);
  }

  log(`Starting daemon v3 with ${pool.bots.length} bot(s)`);
  log(
    `Admins: ${getAdmins().join(", ")} | Max concurrent: ${getConfig().maxConcurrent}`,
  );

  for (let i = 0; i < pool.bots.length; i++) {
    const config = pool.bots[i];
    const tgBot = new Bot(config.token);
    const managed: ManagedBot = {
      config,
      bot: tgBot,
      busy: false,
      lastInvoke: 0,
      lastActivity: 0,
      lastMemorySave: 0,
      contextUsed: 0,
      contextWindow: 0,
      lastModel: "",
      lastCostUSD: 0,
    };

    managedBots.set(config.token, managed);
    if (config.username) botByUsername.set(config.username, managed);
    if (config.role === "master") masterBot = managed;

    setupBot(managed);

    setTimeout(async () => {
      try {
        await tgBot.start({
          drop_pending_updates: true,
          onStart: (info) => {
            log(
              `ONLINE: @${info.username} → ${config.assignedProject ?? config.role ?? "?"}`,
            );
            if (!config.username) {
              config.username = info.username;
              botByUsername.set(info.username, managed);
            }
          },
        });
      } catch (err) {
        if (err instanceof GrammyError && err.error_code === 409) {
          log(`409: ${config.username ?? "?"} — retry in 15s`);
          setTimeout(
            () => tgBot.start({ drop_pending_updates: true }).catch(() => {}),
            POLL_RETRY_DELAY_MS,
          );
        } else {
          log(`POLL_FAIL: ${config.username ?? "?"} — ${err}`);
        }
      }
    }, i * BOT_START_STAGGER_MS);
  }

  // Restart notification — works whether Claude wrote a note or not

  setTimeout(async () => {
    if (!masterBot) return;
    const pool = loadPool();
    if (!pool.sharedGroupId) return;
    try {
      if (existsSync(RESTART_NOTE_FILE)) {
        const note = JSON.parse(readFileSync(RESTART_NOTE_FILE, "utf8"));
        await masterBot.bot.api.sendMessage(
          pool.sharedGroupId,
          `🔄 Daemon 已重启\n📂 ${note.project ?? "?"}\n📝 ${note.summary ?? ""}`,
        );
        unlinkSync(RESTART_NOTE_FILE);
      } else {
        // No note — check log to see if a Claude INVOKE preceded the shutdown
        const tail = existsSync(LOG_FILE)
          ? readFileSync(LOG_FILE, "utf8").slice(-2000)
          : "";
        if (tail.includes("Shutting down...") && tail.includes("INVOKE:")) {
          await masterBot.bot.api.sendMessage(
            pool.sharedGroupId,
            `🔄 Daemon 已重启（由项目 bot 触发）`,
          );
        }
      }
    } catch {}
  }, RESTART_NOTIFY_DELAY_MS);

  setTimeout(() => updateDashboard(), DASHBOARD_INITIAL_DELAY_MS);
  setInterval(() => updateDashboard(), getConfig().dashboardIntervalMs);
  setInterval(() => checkCron(), CRON_CHECK_INTERVAL_MS);
  // Check memory on configured interval (read from pool config each time)
  setInterval(() => checkMemory(), MEMORY_CHECK_MS);

  log("Daemon v3 running.");
}

// ── Shutdown ──
function shutdown(): void {
  log("Shutting down...");
  for (const [, m] of managedBots) m.bot.stop().catch(() => {});
  // PID file is managed by watchdog.sh / daemon.sh stop
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
