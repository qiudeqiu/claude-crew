import { readFileSync, writeFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { BotPool, CronJob, PoolBot } from "./types.js";

// ── Paths ──
export const STATE_DIR =
  process.env.TELEGRAM_POOL_DIR ??
  join(homedir(), ".claude", "channels", "telegram");
export const POOL_FILE = join(STATE_DIR, "bot-pool.json");
export const LOG_FILE = join(STATE_DIR, "daemon.log");
export const PID_FILE = join(STATE_DIR, "daemon.pid");
export const CRON_FILE = join(STATE_DIR, "cron.json");
export const DASHBOARD_FILE = join(STATE_DIR, "dashboard-msg.json");
export const INBOX_DIR = join(STATE_DIR, "inbox");
export const RESTART_NOTE_FILE = join(STATE_DIR, "restart-note.json");

// ── Constants ──
export const DEFAULT_MAX_CONCURRENT = 3;
export const DEFAULT_RATE_LIMIT_S = 5;
export const DEFAULT_SESSION_TIMEOUT_MIN = 10;
export const DEFAULT_DASHBOARD_INTERVAL_MIN = 30;
export const CRON_CHECK_INTERVAL_MS = 60_000;
export const MEMORY_CHECK_MS = 600_000;
export const TYPING_INTERVAL_MS = 4_000;
export const PROGRESS_THROTTLE_MS = 2_000;
export const APPROVAL_TIMEOUT_MS = 120_000;
export const BOT_START_STAGGER_MS = 2_000;
export const CONVERSATION_TTL_MS = 300_000;
export const CONVERSATION_CLEANUP_MS = 60_000;
export const POLL_RETRY_DELAY_MS = 15_000;
export const DASHBOARD_INITIAL_DELAY_MS = 15_000;
export const RESTART_NOTIFY_DELAY_MS = 16_000;
export const LOG_MAX_BYTES = 500_000;
export const MAX_QUEUE_SIZE = 5;
export const CONTEXT_WARN_THRESHOLD = 0.8;
export const CONTEXT_COMPACT_THRESHOLD = 0.95;
export const CONTEXT_WARN_COOLDOWN_MS = 86_400_000; // 24h
export const LOG_RETAIN_BYTES = 250_000;
export const LOG_ROTATE_INTERVAL = 200;
export const CONTEXT_BAR_LENGTH = 10;
export const WRITE_TOOLS = "Bash,Edit,Write,NotebookEdit,Agent,Skill";
export const READONLY_DISALLOWED = "Bash,Edit,Write,NotebookEdit";

// ── Pool I/O (cached, invalidated on save or file change) ──
let poolCache: { data: BotPool; mtimeMs: number } | null = null;

export function loadPool(): BotPool {
  try {
    const stat = statSync(POOL_FILE);
    if (poolCache && poolCache.mtimeMs === stat.mtimeMs) {
      return poolCache.data;
    }
    const data = JSON.parse(readFileSync(POOL_FILE, "utf8")) as BotPool;
    poolCache = { data, mtimeMs: stat.mtimeMs };
    return data;
  } catch {
    // File missing (first run) or corrupted — return empty pool
    return { bots: [] };
  }
}

export function savePool(pool: BotPool): void {
  writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2) + "\n", {
    mode: 0o600,
  });
  // Invalidate cache so next loadPool() picks up the new data
  poolCache = null;
}

export function loadCron(): CronJob[] {
  try {
    return JSON.parse(readFileSync(CRON_FILE, "utf8")) as CronJob[];
  } catch {
    // File missing or corrupted — return empty list
    return [];
  }
}

export function saveCron(jobs: CronJob[]): void {
  writeFileSync(CRON_FILE, JSON.stringify(jobs, null, 2) + "\n", {
    mode: 0o600,
  });
}

// ── Config accessor (re-reads pool each call for hot-reload) ──
export function getConfig() {
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

// ── Auth ──
export function getAdmins(): string[] {
  const pool = loadPool();
  return pool.admins ?? [];
}

export function isAdmin(userId: string): boolean {
  return getAdmins().includes(userId);
}

export function canUseBot(userId: string, botConfig: PoolBot): boolean {
  if (isAdmin(userId)) return true;
  return botConfig.allowedUsers?.includes(userId) ?? false;
}

export function getBotAccessLevel(
  botConfig: PoolBot,
): "readWrite" | "readOnly" {
  return botConfig.accessLevel ?? loadPool().accessLevel ?? "readWrite";
}

export function getBotPermissionMode(
  botConfig: PoolBot,
): "allowAll" | "approve" | "auto" {
  return botConfig.permissionMode ?? loadPool().permissionMode ?? "approve";
}

export function getBotModel(botConfig: PoolBot): string | undefined {
  const model = botConfig.model ?? loadPool().model;
  return model || undefined;
}

export function getMasterName(pool?: BotPool): string {
  const p = pool ?? loadPool();
  return p.bots.find((b) => b.role === "master")?.username ?? "master";
}

export function createProjectBot(
  token: string,
  username: string,
  project: string,
  path: string,
  pool?: BotPool,
): PoolBot {
  const p = pool ?? loadPool();
  return {
    token,
    username,
    role: "project",
    assignedProject: project,
    assignedPath: path,
    accessLevel: "readWrite",
    permissionMode: p.permissionMode ?? "approve",
    allowedUsers: [],
  };
}

export function validateConfig(): void {
  const admins = getAdmins();
  if (admins.length === 0) {
    // Can't use log() here (circular), use stderr
    process.stderr.write(
      "FATAL: no admins configured — set admins in bot-pool.json\n",
    );
    process.exit(1);
  }
}

// ── Auto-migration: fill missing fields with defaults on startup ──
export function migrateConfig(): string[] {
  const raw = readFileSync(POOL_FILE, "utf8");
  const pool = JSON.parse(raw) as Record<string, unknown>;
  const added: string[] = [];

  // Global defaults
  const globalDefaults: Record<string, unknown> = {
    accessLevel: "readWrite",
    permissionMode: "approve",
    masterExecute: false,
    maxConcurrent: DEFAULT_MAX_CONCURRENT,
    rateLimitSeconds: DEFAULT_RATE_LIMIT_S,
    sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MIN,
    dashboardIntervalMinutes: DEFAULT_DASHBOARD_INTERVAL_MIN,
    memoryIntervalMinutes: 120,
    whisperLanguage: "",
    language: "en",
  };

  for (const [key, defaultVal] of Object.entries(globalDefaults)) {
    if (!(key in pool)) {
      pool[key] = defaultVal;
      added.push(key);
    }
  }

  // Per-bot defaults (project bots only)
  const bots = pool.bots as Array<Record<string, unknown>>;
  if (Array.isArray(bots)) {
    for (const bot of bots) {
      if (bot.role !== "project") continue;
      if (!("accessLevel" in bot)) {
        bot.accessLevel = "readWrite";
        added.push(`${bot.username}.accessLevel`);
      }
      if (!("permissionMode" in bot)) {
        bot.permissionMode = pool.permissionMode ?? "allowAll";
        added.push(`${bot.username}.permissionMode`);
      }
      if (!("allowedUsers" in bot)) {
        bot.allowedUsers = [];
        added.push(`${bot.username}.allowedUsers`);
      }
    }
  }

  if (added.length > 0) {
    writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2) + "\n", {
      mode: 0o600,
    });
  }

  return added;
}
