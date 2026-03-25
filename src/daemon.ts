#!/usr/bin/env bun
/**
 * Telegram Bot Pool Daemon v3
 *
 * Architecture: daemon polls all bots, routes messages, spawns `claude -p`
 * with --allowedTools for pre-authorized tool access. Real-time progress
 * via stream-json event parsing.
 */

import { Bot, GrammyError } from "grammy";
import { mkdirSync, existsSync, readFileSync, unlinkSync } from "fs";
import type { ManagedBot } from "./types.js";
import {
  loadPool,
  getAdmins,
  getConfig,
  validateConfig,
  INBOX_DIR,
  RESTART_NOTE_FILE,
  LOG_FILE,
  BOT_START_STAGGER_MS,
  POLL_RETRY_DELAY_MS,
  DASHBOARD_INITIAL_DELAY_MS,
  RESTART_NOTIFY_DELAY_MS,
  CRON_CHECK_INTERVAL_MS,
  MEMORY_CHECK_MS,
} from "./config.js";
import { log } from "./logger.js";
import { managedBots, botByUsername, daemon } from "./state.js";
import { setupBot } from "./bot-setup.js";
import { updateDashboard } from "./dashboard.js";
import { checkCron } from "./cron.js";
import { checkMemory } from "./memory.js";

// ── Startup validation ──
validateConfig();
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
    if (config.role === "master") daemon.masterBot = managed;

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

  // Restart notification
  setTimeout(async () => {
    if (!daemon.masterBot) return;
    const pool = loadPool();
    if (!pool.sharedGroupId) return;
    try {
      if (existsSync(RESTART_NOTE_FILE)) {
        const note = JSON.parse(readFileSync(RESTART_NOTE_FILE, "utf8"));
        await daemon.masterBot.bot.api.sendMessage(
          pool.sharedGroupId,
          `🔄 Daemon 已重启\n📂 ${note.project ?? "?"}\n📝 ${note.summary ?? ""}`,
        );
        unlinkSync(RESTART_NOTE_FILE);
      } else {
        const tail = existsSync(LOG_FILE)
          ? readFileSync(LOG_FILE, "utf8").slice(-2000)
          : "";
        if (tail.includes("Shutting down...") && tail.includes("INVOKE:")) {
          await daemon.masterBot.bot.api.sendMessage(
            pool.sharedGroupId,
            `🔄 Daemon 已重启（由项目 bot 触发）`,
          );
        }
      }
    } catch {}
  }, RESTART_NOTIFY_DELAY_MS);

  // Periodic tasks
  setTimeout(() => updateDashboard(), DASHBOARD_INITIAL_DELAY_MS);
  setInterval(() => updateDashboard(), getConfig().dashboardIntervalMs);
  setInterval(() => checkCron(), CRON_CHECK_INTERVAL_MS);
  setInterval(() => checkMemory(), MEMORY_CHECK_MS);

  log("Daemon v3 running.");
}

// ── Shutdown ──
function shutdown(): void {
  log("Shutting down...");
  for (const [, m] of managedBots) m.bot.stop().catch(() => {});
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
