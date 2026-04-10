#!/usr/bin/env bun
// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Claude Crew Daemon v4
 *
 * Multi-platform bot pool daemon. Polls all bots, routes messages,
 * spawns `claude -p` per task. Real-time progress via stream-json.
 */

import { Bot, GrammyError } from "grammy";
import { TelegramAdapter } from "./platform/telegram/adapter.js";
import { DiscordAdapter } from "./platform/discord/adapter.js";
import { FeishuAdapter } from "./platform/feishu/adapter.js";
import { registerPlatformHandlers } from "./handler.js";
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
  getAdminIds,
  getOwner,
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
  CONVERSATION_CLEANUP_MS,
} from "./config.js";
import { log } from "./logger.js";
import { managedBots, botByUsername, daemon } from "./state.js";
import { setupBot } from "./bot-setup.js";
import { updateDashboard } from "./dashboard.js";
import { checkCron } from "./cron.js";
import { cleanupExpired } from "./interactive/index.js";
// i18n is imported dynamically where needed

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
const migrated = migrateConfig();
validateConfig();
if (migrated.length > 0) {
  process.stderr.write(`[migrate] added defaults: ${migrated.join(", ")}\n`);
}
log(`Auth: owner=${getOwner()}, admins=${getAdminIds().join(", ")}`);

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
  log(`Starting daemon v4 with ${pool.bots.length} bot(s) [${platformType}]`);
  log(
    `Admins: ${getAdminIds().join(", ")} | Max concurrent: ${getConfig().maxConcurrent}`,
  );

  for (let i = 0; i < pool.bots.length; i++) {
    const config = pool.bots[i];

    // Create platform adapter based on config
    const adapter =
      platformType === "feishu"
        ? new FeishuAdapter(config.token)
        : platformType === "discord"
          ? new DiscordAdapter(config.token)
          : new TelegramAdapter(config.token);
    const tgBot =
      platformType === "telegram"
        ? (adapter as TelegramAdapter).raw
        : undefined;

    const managed: ManagedBot = {
      config,
      bot: tgBot,
      platform: adapter,
      busy: false,
      lastInvoke: 0,
      lastActivity: 0,
      contextUsed: 0,
      contextWindow: 0,
      lastModel: "",
      lastCostUSD: 0,
      queue: [],
    };

    managedBots.set(config.token, managed);
    if (config.username) botByUsername.set(config.username, managed);
    if (config.role === "master") daemon.masterBot = managed;

    // Telegram: register grammY handlers + start polling
    // Discord: start via Platform interface (no grammY handlers)
    if (platformType === "telegram" && tgBot) {
      setupBot(managed);

      setTimeout(async () => {
        try {
          if (config.role === "master" && "setCommandMenu" in adapter) {
            await (
              adapter as import("./platform/telegram/adapter.js").TelegramAdapter
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
                managed.config = { ...config, username: info.username };
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
    } else if (platformType === "discord") {
      // Discord: shared handler with Discord-specific hooks
      const discordAdapter =
        adapter as import("./platform/discord/adapter.js").DiscordAdapter;
      registerPlatformHandlers(managed, adapter, config, {
        stripMentions: (msg) =>
          (msg.text ?? "").replace(/<@[&!]?\d+>/g, "").trim(),
        isMentionedIn: (msg) => discordAdapter.isMentionedIn(msg),
        isGroupMessage: () => true, // Discord channels are always "group"
        logLabel: "Discord",
      });

      // Start Discord bot
      setTimeout(async () => {
        try {
          await adapter.start((info) => {
            log(
              `ONLINE: ${info.username} → ${config.assignedProject ?? config.role ?? "?"}`,
            );
            if (!config.username) {
              managed.config = { ...config, username: info.username };
              botByUsername.set(info.username, managed);
            }
          });
        } catch (err) {
          log(`DISCORD_FAIL: ${config.username ?? "?"} — ${err}`);
        }
      }, i * BOT_START_STAGGER_MS);
    } else if (platformType === "feishu") {
      // Feishu: shared handler with Feishu-specific hooks
      const feishuAdapter = adapter as FeishuAdapter;
      registerPlatformHandlers(managed, adapter, config, {
        stripMentions: (msg) => feishuAdapter.stripMentions(msg),
        isMentionedIn: (msg) => feishuAdapter.isMentionedIn(msg),
        isGroupMessage: (msg) => {
          const raw = msg.raw as
            | { message?: { chat_type?: string } }
            | undefined;
          return raw?.message?.chat_type === "group";
        },
        logLabel: "Feishu",
      });

      // Start Feishu bot
      setTimeout(async () => {
        try {
          await adapter.start((info) => {
            log(
              `ONLINE: ${info.username} → ${config.assignedProject ?? config.role ?? "?"}`,
            );
            if (!config.username) {
              managed.config = { ...config, username: info.username };
              botByUsername.set(info.username, managed);
            }
          });
        } catch (err) {
          log(`FEISHU_FAIL: ${config.username ?? "?"} — ${err}`);
        }
      }, i * BOT_START_STAGGER_MS);
    }
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

    // Send startup message + menu (bound to owner)
    try {
      const { getLang, menuMsg } = await import("./interactive/i18n.js");
      const { showMainMenu } = await import("./interactive/index.js");
      const { getOwner } = await import("./config.js");
      const lang = getLang();
      const m = menuMsg(lang);
      const ownerId = getOwner();
      await daemon.masterBot!.platform.sendMessage(
        pool.sharedGroupId,
        m.started,
      );
      await showMainMenu(
        daemon.masterBot!,
        pool.sharedGroupId,
        undefined,
        ownerId,
      );
      // Pre-bind the menu to owner (will be set on first click via routeCallback)
    } catch (e) {
      log(`WARN: startup notification failed: ${e}`);
    }
  }, RESTART_NOTIFY_DELAY_MS);

  // Periodic tasks
  setInterval(() => updateDashboard(), getConfig().dashboardIntervalMs);
  setInterval(() => checkCron(), CRON_CHECK_INTERVAL_MS);
  setInterval(() => cleanupExpired(), CONVERSATION_CLEANUP_MS);

  log("Daemon v4 running.");
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
