import { readFileSync, writeFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  BotPool,
  RawBotPool,
  PlatformSection,
  CronJob,
  PoolBot,
} from "./types.js";

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

// ── Resilience ──
export const CIRCUIT_BREAKER_MAX_FAILURES = 3;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 300_000; // 5 min auto-recovery
export const DENIAL_MAX_CONSECUTIVE = 5;
export const DENIAL_WINDOW_MS = 60_000; // sliding window
export const MAX_TRUNCATION_RECOVERIES = 2; // max auto-continue attempts

/** Platform-aware message character limit */
export function getMessageLimit(): number {
  return getPlatform() === "discord" ? 2000 : 4096;
}
export const WRITE_TOOLS = "Bash,Edit,Write,NotebookEdit,Agent,Skill";
export const READONLY_DISALLOWED = "Bash,Edit,Write,NotebookEdit";

// ── Pool I/O (cached, invalidated on save or file change) ──
// On-disk format uses platform sections; loadPool() returns a flattened view
// so all consuming code sees the same BotPool shape regardless of format.
let rawCache: { data: RawBotPool; mtimeMs: number } | null = null;

export type PlatformType = "telegram" | "discord";

/** Read the raw on-disk format (platform sections + shared settings). */
export function loadPoolRaw(): RawBotPool {
  try {
    const stat = statSync(POOL_FILE);
    if (rawCache && rawCache.mtimeMs === stat.mtimeMs) {
      return rawCache.data;
    }
    const data = JSON.parse(readFileSync(POOL_FILE, "utf8")) as RawBotPool;
    rawCache = { data, mtimeMs: stat.mtimeMs };
    return data;
  } catch {
    return { activePlatform: "telegram", telegram: { bots: [] } };
  }
}

const VALID_PLATFORMS: ReadonlySet<string> = new Set(["telegram", "discord"]);

export function getPlatform(): PlatformType {
  try {
    const raw = loadPoolRaw();
    // New format: activePlatform field (validated)
    if (raw.activePlatform && VALID_PLATFORMS.has(raw.activePlatform)) {
      return raw.activePlatform;
    }
    // Legacy flat format: platform field
    const legacy = raw as Record<string, unknown>;
    return legacy.platform === "discord" ? "discord" : "telegram";
  } catch {
    return "telegram";
  }
}

/**
 * Returns a flattened BotPool view of the active platform.
 * All consuming code uses this — platform isolation is transparent.
 */
export function loadPool(): BotPool {
  const raw = loadPoolRaw();
  const platform = getPlatform();

  // New format: read from platform section
  if (raw.activePlatform || raw.telegram || raw.discord) {
    const section: PlatformSection = raw[platform] ?? { bots: [] };
    return {
      platform,
      bots: section.bots ?? [],
      admins: section.admins,
      sharedGroupId: section.sharedGroupId,
      approvers: section.approvers,
      // Shared settings from top level
      accessLevel: raw.accessLevel,
      permissionMode: raw.permissionMode,
      memoryIntervalMinutes: raw.memoryIntervalMinutes,
      masterExecute: raw.masterExecute,
      maxConcurrent: raw.maxConcurrent,
      rateLimitSeconds: raw.rateLimitSeconds,
      sessionTimeoutMinutes: raw.sessionTimeoutMinutes,
      dashboardIntervalMinutes: raw.dashboardIntervalMinutes,
      whisperLanguage: raw.whisperLanguage,
      language: raw.language,
      model: raw.model,
    };
  }

  // Legacy flat format fallback (pre-migration)
  return raw as unknown as BotPool;
}

/**
 * Save a flattened BotPool back to the platform-segmented on-disk format.
 * Platform-specific fields go to the active section; shared fields go to top level.
 */
export function savePool(pool: BotPool): void {
  const raw = loadPoolRaw();
  const platform = pool.platform ?? raw.activePlatform ?? "telegram";

  // Build new object — never mutate the cached raw
  const updated: RawBotPool = {
    ...raw,
    activePlatform: platform,
    [platform]: {
      admins: pool.admins,
      approvers: pool.approvers,
      sharedGroupId: pool.sharedGroupId,
      bots: pool.bots,
    },
    accessLevel: pool.accessLevel,
    permissionMode: pool.permissionMode,
    memoryIntervalMinutes: pool.memoryIntervalMinutes,
    masterExecute: pool.masterExecute,
    maxConcurrent: pool.maxConcurrent,
    rateLimitSeconds: pool.rateLimitSeconds,
    sessionTimeoutMinutes: pool.sessionTimeoutMinutes,
    dashboardIntervalMinutes: pool.dashboardIntervalMinutes,
    whisperLanguage: pool.whisperLanguage,
    language: pool.language,
    model: pool.model,
  };

  writeFileSync(POOL_FILE, JSON.stringify(updated, null, 2) + "\n", {
    mode: 0o600,
  });
  rawCache = null;
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

// ── Auto-migration: flat→segmented format + fill missing defaults ──
export function migrateConfig(): string[] {
  const rawText = readFileSync(POOL_FILE, "utf8");
  const pool = JSON.parse(rawText) as Record<string, unknown>;
  const added: string[] = [];

  // ── Phase 1: Migrate flat format → platform-segmented format ──
  if (!("activePlatform" in pool) && Array.isArray(pool.bots)) {
    const platform =
      (pool.platform as string) === "discord" ? "discord" : "telegram";
    // Move platform-specific fields into their section
    pool.activePlatform = platform;
    pool[platform] = {
      admins: pool.admins,
      approvers: pool.approvers,
      sharedGroupId: pool.sharedGroupId,
      bots: pool.bots,
    };
    // Clean up moved fields from top level
    delete pool.admins;
    delete pool.approvers;
    delete pool.sharedGroupId;
    delete pool.bots;
    delete pool.platform;
    added.push(`migrated to ${platform} section`);
  }

  // ── Phase 2: Fill missing shared defaults ──
  const sharedDefaults: Record<string, unknown> = {
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

  for (const [key, defaultVal] of Object.entries(sharedDefaults)) {
    if (!(key in pool)) {
      pool[key] = defaultVal;
      added.push(key);
    }
  }

  // ── Phase 3: Per-bot defaults (active platform only) ──
  const platform = pool.activePlatform as string;
  const section = pool[platform] as Record<string, unknown> | undefined;
  const bots = (section?.bots ?? []) as Array<Record<string, unknown>>;
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
    rawCache = null;
  }

  return added;
}
