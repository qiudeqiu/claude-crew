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
  canUseBot,
  isAdmin,
  validateConfig,
  migrateConfig,
  MAX_QUEUE_SIZE,
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
import { setupMsg, getLang } from "./interactive/i18n.js";

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
    } else if (platformType === "discord") {
      // Discord: register message handlers via Platform interface
      adapter.onMessage(async (msg) => {
        if (!msg.userId || !msg.text) return;
        const authorized = canUseBot(msg.userId, config);
        log(
          `RAW: ${config.username ?? "?"} ← ${msg.username ?? "?"}(${msg.userId}) auth=${authorized}: ${(msg.text ?? "").slice(0, 60)}`,
        );
        if (!authorized) {
          await adapter
            .sendMessage(msg.chatId, setupMsg(getLang()).noPermission)
            .catch(() => {});
          return;
        }
        // Check for bot mention in Discord (<@botId> format)
        const botMention = `<@${(adapter as import("./platform/discord/adapter.js").DiscordAdapter).botId ?? ""}>`;
        const isMentioned = msg.text.includes(botMention);
        if (!isMentioned && !msg.replyTo) return;

        const text = msg.text.replace(/<@\d+>/g, "").trim();
        if (!text) return;

        // Slash commands
        const cmdText = text.replace(/^\//, "");
        const { handleBotSlashCommand } = await import("./bot-commands.js");
        const handled = await handleBotSlashCommand(
          managed,
          msg.chatId,
          cmdText,
        );
        if (handled) return;

        // Master bot commands
        if (config.role === "master") {
          const stripped = text.replace(/^\//, "");
          const { handleMasterCommand } = await import("./commands.js");
          const directReply = handleMasterCommand(stripped);
          if (directReply !== undefined) {
            if (directReply !== null) {
              const { splitMessage } = await import("./helpers.js");
              for (const chunk of splitMessage(directReply)) {
                await adapter.sendMessage(msg.chatId, chunk).catch(() => {});
              }
            }
            return;
          }
          // Show menu for unrecognized master input
          if (!loadPool().masterExecute) {
            const { showMainMenu } = await import("./interactive/index.js");
            await showMainMenu(managed, msg.chatId);
            return;
          }
        }

        if (!config.assignedPath && config.role !== "master") return;
        if (managed.busy) {
          if (managed.queue.length < MAX_QUEUE_SIZE) {
            managed.queue.push({
              chatId: msg.chatId,
              userId: msg.userId,
              message: text,
              queuedAt: Date.now(),
              requesterName: msg.username,
            });
            const pos = managed.queue.length;
            await adapter
              .sendMessage(
                msg.chatId,
                getLang() === "zh"
                  ? `⏳ 你是第 ${pos + 1} 个，前面还有 ${pos} 个任务`
                  : `⏳ You're #${pos + 1} in queue, ${pos} task(s) ahead`,
              )
              .catch(() => {});
          }
          return;
        }

        await adapter.setReaction(msg.chatId, msg.id, "👀").catch(() => {});
        const { invokeClaudeAndReply } = await import("./claude.js");
        void invokeClaudeAndReply(
          managed,
          msg.chatId,
          text,
          undefined,
          msg.username,
        );
      });

      adapter.onCallback(async (event) => {
        // Route interactive callbacks
        if (!isAdmin(event.userId)) {
          await adapter
            .answerCallback(event.id, setupMsg(getLang()).adminOnly)
            .catch(() => {});
          return;
        }
        if (config.role === "master") {
          const { routeCallback } = await import("./interactive/index.js");
          await routeCallback(
            managed,
            event.chatId,
            event.userId,
            event.data,
            Number(event.messageId),
          );
        }
      });

      // Start Discord bot
      setTimeout(async () => {
        try {
          await adapter.start((info) => {
            log(
              `ONLINE: ${info.username} → ${config.assignedProject ?? config.role ?? "?"}`,
            );
            if (!config.username) {
              config.username = info.username;
              botByUsername.set(info.username, managed);
            }
          });
        } catch (err) {
          log(`DISCORD_FAIL: ${config.username ?? "?"} — ${err}`);
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
