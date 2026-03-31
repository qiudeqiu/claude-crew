#!/usr/bin/env bun
/**
 * Telegram Bot Pool Daemon v3
 *
 * Architecture: daemon polls all bots, routes messages, spawns `claude -p`
 * with --allowedTools for pre-authorized tool access. Real-time progress
 * via stream-json event parsing.
 */

import { Bot, GrammyError } from "grammy";
import { TelegramAdapter } from "./platform/telegram/adapter.js";
import { DiscordAdapter } from "./platform/discord/adapter.js";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { execFileSync } from "child_process";
import type { ManagedBot } from "./types.js";
import {
  loadPool,
  getAdmins,
  getConfig,
  validateConfig,
  migrateConfig,
  INBOX_DIR,
  PID_FILE,
  RESTART_NOTE_FILE,
  LOG_FILE,
  BOT_START_STAGGER_MS,
  POLL_RETRY_DELAY_MS,
  DASHBOARD_INITIAL_DELAY_MS,
  RESTART_NOTIFY_DELAY_MS,
  CRON_CHECK_INTERVAL_MS,
  MEMORY_CHECK_MS,
  CONVERSATION_CLEANUP_MS,
} from "./config.js";
import { log } from "./logger.js";
import { managedBots, botByUsername, daemon } from "./state.js";
import { setupBot } from "./bot-setup.js";
import { updateDashboard } from "./dashboard.js";
import { checkCron } from "./cron.js";
import { checkMemory } from "./memory.js";
import { cleanupExpired } from "./interactive/index.js";

// ── Singleton: kill any other daemon.ts processes + write PID file ──
{
  const myPid = process.pid;
  try {
    const ps = execFileSync("pgrep", ["-f", "bun run.*daemon.ts"], {
      encoding: "utf8",
    }).trim();
    const pids = ps
      .split("\n")
      .map((p: string) => parseInt(p, 10))
      .filter((p: number) => p !== myPid && !isNaN(p));
    if (pids.length > 0) {
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGTERM");
        } catch (e) {
          process.stderr.write(`[singleton] failed to kill ${pid}: ${e}\n`);
        }
      }
      process.stderr.write(
        `[singleton] killed ${pids.length} stale daemon(s): ${pids.join(", ")}\n`,
      );
    }
  } catch {
    // pgrep returns non-zero when no matches — expected
  }
  writeFileSync(PID_FILE, String(myPid), { mode: 0o600 });
}

// ── Startup validation & migration ──
validateConfig();
const migrated = migrateConfig();
if (migrated.length > 0) {
  process.stderr.write(`[migrate] added defaults: ${migrated.join(", ")}\n`);
}
log(`Auth: ${getAdmins().length} admin(s): ${getAdmins().join(", ")}`);

// ══════════════════════════════════════
// ── Main ──
// ══════════════════════════════════════
async function main(): Promise<void> {
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

  const platformType = pool.platform ?? "telegram";
  log(`Starting daemon v3 with ${pool.bots.length} bot(s) [${platformType}]`);
  log(
    `Admins: ${getAdmins().join(", ")} | Max concurrent: ${getConfig().maxConcurrent}`,
  );

  for (let i = 0; i < pool.bots.length; i++) {
    const config = pool.bots[i];

    // Create platform adapter based on config
    const adapter =
      platformType === "discord"
        ? new DiscordAdapter(config.token)
        : new TelegramAdapter(config.token);
    const tgBot =
      platformType === "telegram"
        ? (adapter as TelegramAdapter).raw
        : (null as unknown as Bot); // Discord has no grammY Bot

    const managed: ManagedBot = {
      config,
      bot: tgBot,
      platform: adapter,
      busy: false,
      lastInvoke: 0,
      lastActivity: 0,
      lastMemorySave: 0,
      contextUsed: 0,
      contextWindow: 0,
      lastModel: "",
      lastCostUSD: 0,
      queue: [],
    };

    managedBots.set(config.token, managed);
    if (config.username) botByUsername.set(config.username, managed);
    if (config.role === "master") daemon.masterBot = managed;

    setupBot(managed);

    setTimeout(async () => {
      try {
        // Register command menu for master bot
        if (config.role === "master" && "setCommandMenu" in tgAdapter) {
          await (
            tgAdapter as import("./platform/telegram/adapter.js").TelegramAdapter
          )
            .setCommandMenu([
              { command: "menu", description: "Main menu" },
              { command: "bots", description: "Manage project bots" },
              { command: "config", description: "Edit global settings" },
              { command: "users", description: "Manage admins & users" },
              { command: "setup", description: "First-time setup wizard" },
              { command: "status", description: "Refresh dashboard" },
              { command: "restart", description: "Restart daemon" },
            ])
            .catch(() => {});
        }

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

  // On startup: send main menu to group
  setTimeout(async () => {
    if (!daemon.masterBot) return;
    const pool = loadPool();
    if (!pool.sharedGroupId) return;

    // Clean up restart note if present
    if (existsSync(RESTART_NOTE_FILE)) {
      try {
        unlinkSync(RESTART_NOTE_FILE);
      } catch (e) {
        log(`WARN: failed to clean restart note: ${e}`);
      }
    }

    // Send startup message + menu
    try {
      const { getLang, menuMsg } = await import("./interactive/i18n.js");
      const { showMainMenu } = await import("./interactive/index.js");
      const lang = getLang();
      const m = menuMsg(lang);
      await daemon.masterBot!.platform.sendMessage(
        pool.sharedGroupId,
        m.started,
      );
      await showMainMenu(daemon.masterBot!, pool.sharedGroupId);
    } catch (e) {
      log(`WARN: startup notification failed: ${e}`);
    }
  }, RESTART_NOTIFY_DELAY_MS);

  // Periodic tasks
  setInterval(() => updateDashboard(), getConfig().dashboardIntervalMs);
  setInterval(() => checkCron(), CRON_CHECK_INTERVAL_MS);
  setInterval(() => checkMemory(), MEMORY_CHECK_MS);
  setInterval(() => cleanupExpired(), CONVERSATION_CLEANUP_MS);

  log("Daemon v3 running.");
}

// ── Shutdown ──
function shutdown(): void {
  log("Shutting down...");
  for (const [, m] of managedBots) m.platform.stop().catch(() => {});
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
