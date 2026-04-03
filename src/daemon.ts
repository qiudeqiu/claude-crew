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
  CONVERSATION_CLEANUP_MS,
  WRITE_TOOLS,
} from "./config.js";
import { log } from "./logger.js";
import { managedBots, botByUsername, daemon } from "./state.js";
import { setupBot } from "./bot-setup.js";
import { updateDashboard } from "./dashboard.js";
import { checkCron } from "./cron.js";
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
      // Discord: register message handlers via Platform interface
      adapter.onMessage(async (msg) => {
        if (!msg.userId || (!msg.text && !msg.photoFileId)) return;
        const authorized = canUseBot(msg.userId, config);

        // Interactive text flow: active conversation takes priority (no @mention needed)
        // Strip Discord mentions before routing (same as Telegram strips @mentions)
        if (authorized && config.role === "master") {
          const { routeText } = await import("./interactive/index.js");
          const cleanText = (msg.text ?? "").replace(/<@[&!]?\d+>/g, "").trim();
          if (cleanText) {
            const handled = await routeText(
              managed,
              msg.chatId,
              msg.userId,
              cleanText,
            );
            if (handled) return;
          }
        }

        // Check for bot mention (user or role) or reply to THIS bot's message
        const discordAdapter =
          adapter as import("./platform/discord/adapter.js").DiscordAdapter;
        const discordBotId = discordAdapter.botId ?? "";
        const isMentioned = discordAdapter.isMentionedIn(msg);
        const isReplyToMe = msg.replyTo?.userId === discordBotId;
        if (!isMentioned && !isReplyToMe) return;

        // Only log targeted messages (mentioned or replied)
        log(
          `RAW: ${config.username ?? "?"} ← ${msg.username ?? "?"}(${msg.userId}) auth=${authorized}: ${(msg.text ?? "").slice(0, 60)}`,
        );
        if (!authorized) {
          await adapter
            .sendMessage(msg.chatId, setupMsg(getLang()).noPermission)
            .catch(() => {});
          return;
        }

        const text = (msg.text ?? "").replace(/<@[&!]?\d+>/g, "").trim();
        if (!text && !msg.photoFileId) return;

        // Slash commands (/new, /compact, /model, etc.)
        const cmdText = text.replace(/^\//, "");
        const { handleBotSlashCommand } = await import("./bot-commands.js");
        const slashHandled = await handleBotSlashCommand(
          managed,
          msg.chatId,
          cmdText,
        );
        if (slashHandled) return;

        // Master bot: interactive commands (menu, bots, config, users, setup)
        if (config.role === "master") {
          const stripped = text.replace(/^\//, "");

          if (/^(help|menu|start)$/i.test(stripped)) {
            const { showMainMenu } = await import("./interactive/index.js");
            await showMainMenu(managed, msg.chatId, undefined, msg.userId);
            return;
          }
          if (/^setup$/i.test(stripped)) {
            const { startOnboarding } =
              await import("./interactive/onboarding.js");
            await startOnboarding(managed, msg.chatId, msg.userId);
            return;
          }
          if (/^(bots|addbot)$/i.test(stripped)) {
            const { hasPermission } = await import("./config.js");
            if (!hasPermission(msg.userId, "bots")) return;
            const { showBotList } =
              await import("./interactive/bot-management.js");
            await showBotList(managed, msg.chatId);
            return;
          }
          if (/^config$/i.test(stripped)) {
            const { hasPermission } = await import("./config.js");
            if (!hasPermission(msg.userId, "config")) return;
            const { showGlobalConfig } =
              await import("./interactive/config-editor.js");
            await showGlobalConfig(managed, msg.chatId);
            return;
          }
          if (/^users$/i.test(stripped)) {
            const { hasPermission } = await import("./config.js");
            if (!hasPermission(msg.userId, "users")) return;
            const { showUserManagement } =
              await import("./interactive/user-management.js");
            await showUserManagement(
              managed,
              msg.chatId,
              undefined,
              msg.userId,
            );
            return;
          }

          // Text-only master commands (status, restart, cron, search)
          const { handleMasterCommand } = await import("./commands.js");
          const directReply = handleMasterCommand(stripped, msg.userId);
          if (directReply !== undefined) {
            if (directReply !== null) {
              const { splitMessage } = await import("./helpers.js");
              const { getMessageLimit } = await import("./config.js");
              for (const chunk of splitMessage(
                directReply,
                getMessageLimit(),
              )) {
                await adapter.sendMessage(msg.chatId, chunk).catch(() => {});
              }
            }
            return;
          }

          // Unrecognized input → show menu (if masterExecute disabled)
          if (!loadPool().masterExecute) {
            const { showMainMenu } = await import("./interactive/index.js");
            await showMainMenu(managed, msg.chatId, undefined, msg.userId);
            return;
          }
        }

        // Project bot: intercept master-only commands
        if (config.role !== "master" && text) {
          const stripped = text.replace(/^\//, "");
          if (
            /^cron\s/i.test(stripped) ||
            /^(help|setup|bots|config|users|restart)$/i.test(stripped) ||
            /^search\s/i.test(stripped)
          ) {
            const { getMasterName } = await import("./config.js");
            const masterName = getMasterName();
            await adapter
              .sendMessage(
                msg.chatId,
                setupMsg(getLang()).masterOnly(masterName),
              )
              .catch(() => {});
            return;
          }
        }

        if (!config.assignedPath && config.role !== "master") {
          await adapter
            .sendMessage(
              msg.chatId,
              setupMsg(getLang()).noProject(config.username ?? "?"),
            )
            .catch(() => {});
          return;
        }
        if (managed.busy) {
          if (managed.queue.length >= MAX_QUEUE_SIZE) {
            await adapter
              .sendMessage(
                msg.chatId,
                setupMsg(getLang()).queueFull(
                  managed.queue.length + 1,
                  MAX_QUEUE_SIZE,
                ),
              )
              .catch(() => {});
            return;
          }
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
          return;
        }

        // Download image if present
        let imagePath: string | undefined;
        if (msg.photoFileId) {
          imagePath = await adapter.downloadFile(msg.photoFileId);
        }

        await adapter.setReaction(msg.chatId, msg.id, "👀").catch(() => {});
        const { invokeClaudeAndReply } = await import("./claude.js");
        void invokeClaudeAndReply(
          managed,
          msg.chatId,
          text,
          imagePath,
          msg.username,
        );
      });

      adapter.onCallback(async (event) => {
        const userId = event.userId;
        // Interactive setup callbacks (o:, b:, c:, u:, m:, x:)
        if (config.role === "master") {
          const { routeCallback } = await import("./interactive/index.js");
          const handled = await routeCallback(
            managed,
            event.chatId,
            userId,
            event.data,
            event.messageId,
            event.id,
          );
          if (handled) return;
        }

        // Approval callbacks (approve:yes:id / approve:no:id)
        const { pendingApprovals } = await import("./state.js");

        if (!isAdmin(userId)) {
          await adapter
            .answerCallback(event.id, setupMsg(getLang()).adminOnly)
            .catch(() => {});
          return;
        }
        if (!event.data.startsWith("approve:")) return;

        const [, action, approvalId] = event.data.split(":");
        const pending = pendingApprovals.get(approvalId!);
        if (!pending) {
          await adapter
            .answerCallback(event.id, setupMsg(getLang()).expired)
            .catch(() => {});
          return;
        }

        const s = setupMsg(getLang());

        if (action === "no") {
          if (
            pending.requiredApprovers.length > 0 &&
            !pending.requiredApprovers.includes(userId) &&
            !isAdmin(userId)
          ) {
            return;
          }
          pendingApprovals.delete(approvalId!);
          pending.resolve(null);
          if (event.messageText) {
            await adapter
              .editButtons(
                event.chatId,
                event.messageId,
                `${event.messageText}\n\n${s.skipped}`,
                [],
              )
              .catch(() => {});
          }
          return;
        }

        // approve:yes
        if (
          pending.requiredApprovers.length > 0 &&
          !pending.requiredApprovers.includes(userId) &&
          !isAdmin(userId)
        ) {
          return;
        }

        if (pending.approvedBy.has(userId)) return;
        pending.approvedBy.add(userId);

        if (pending.requiredApprovers.length === 0) {
          pendingApprovals.delete(approvalId!);
          pending.resolve(WRITE_TOOLS);
          if (event.messageText) {
            await adapter
              .editButtons(
                event.chatId,
                event.messageId,
                `${event.messageText}\n\n${s.authorized}`,
                [],
              )
              .catch(() => {});
          }
        } else {
          const allApproved = pending.requiredApprovers.every((id) =>
            pending.approvedBy.has(id),
          );
          const count = pending.approvedBy.size;
          const total = pending.requiredApprovers.length;

          if (allApproved) {
            pendingApprovals.delete(approvalId!);
            pending.resolve(WRITE_TOOLS);
            if (event.messageText) {
              await adapter
                .editButtons(
                  event.chatId,
                  event.messageId,
                  `${event.messageText}\n\n${s.authorized} (${count}/${total})`,
                  [],
                )
                .catch(() => {});
            }
          } else {
            const lang = getLang();
            const label =
              lang === "zh"
                ? `\u2705 允许 (${count}/${total})`
                : `\u2705 Allow (${count}/${total})`;
            await adapter
              .editButtonsOnly(event.chatId, event.messageId, [
                [
                  { text: label, data: `approve:yes:${approvalId}` },
                  {
                    text: lang === "zh" ? "\u274c 跳过" : "\u274c Skip",
                    data: `approve:no:${approvalId}`,
                  },
                ],
              ])
              .catch(() => {});
          }
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
              managed.config = { ...config, username: info.username };
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
