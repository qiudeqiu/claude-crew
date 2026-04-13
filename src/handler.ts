// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Shared message + callback handler for non-Telegram platforms (Discord, Feishu).
 *
 * Telegram uses grammY middleware in bot-setup.ts (incompatible pattern).
 * Discord and Feishu both use Platform.onMessage/onCallback — this module
 * extracts the shared routing logic to avoid duplication in daemon.ts.
 */

import type { ManagedBot, PoolBot } from "./types.js";
import type {
  Platform,
  PlatformMessage,
  CallbackEvent,
} from "./platform/types.js";
import {
  loadPool,
  canUseBot,
  isAdmin,
  getPlatform,
  MAX_QUEUE_SIZE,
  WRITE_TOOLS,
} from "./config.js";
import { log } from "./logger.js";
import { setupMsg, getLang } from "./interactive/i18n.js";

/** Platform-specific hooks for mention detection and text cleanup. */
export type PlatformHooks = {
  /** Strip platform mention syntax from message text. */
  stripMentions: (msg: PlatformMessage) => string;
  /** Check if this bot was mentioned (for group message filtering). */
  isMentionedIn: (msg: PlatformMessage) => boolean;
  /** Check if the message is a group message (vs. DM/private). */
  isGroupMessage: (msg: PlatformMessage) => boolean;
  /** Platform label for log lines. */
  logLabel: string;
};

/**
 * Register message + callback handlers on a Platform adapter.
 * Extracts the shared routing logic used by Discord and Feishu.
 */
export function registerPlatformHandlers(
  managed: ManagedBot,
  adapter: Platform,
  config: PoolBot,
  hooks: PlatformHooks,
): void {
  adapter.onMessage(async (msg) => {
    if (!msg.userId || (!msg.text && !msg.photoFileId)) return;

    // Live config for access check (reflects runtime allowedUsers changes)
    const liveConf =
      loadPool().bots.find((b) => b.username === config.username) ?? config;
    // Feishu: open_id is per-app, so cross-app permission checks fail.
    // Feishu apps already have enterprise-level access control, so trust all
    // tenant users for bot access. Admin checks still use owner's open_id.
    const authorized =
      getPlatform() === "feishu" || getPlatform() === "wechat"
        ? true
        : canUseBot(msg.userId, liveConf);

    // Interactive text flow: active conversation takes priority (no @mention needed)
    if (authorized && config.role === "master") {
      const { routeText } = await import("./interactive/index.js");
      const cleanText = hooks.stripMentions(msg);
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

    // In groups, require @mention; in DM, accept all
    if (hooks.isGroupMessage(msg)) {
      const isMentioned = hooks.isMentionedIn(msg);
      const isReplyToMe = !!msg.replyTo?.userId; // reply-to-bot detection
      if (!isMentioned && !isReplyToMe) return;
    }

    // Only log targeted messages
    log(
      `RAW: ${config.username ?? "?"} ← ${msg.username ?? "?"}(${msg.userId}) auth=${authorized}: ${(msg.text ?? "").slice(0, 60)}`,
    );
    if (!authorized) {
      await adapter
        .sendMessage(msg.chatId, setupMsg(getLang()).noPermission)
        .catch(() => {});
      return;
    }

    const text = hooks.stripMentions(msg);
    if (!text && !msg.photoFileId) return;

    // Slash commands (/new, /compact, /model, etc.)
    const cmdText = text.replace(/^\//, "");
    const { handleBotSlashCommand } = await import("./bot-commands.js");
    const slashHandled = await handleBotSlashCommand(
      managed,
      msg.chatId,
      cmdText,
      msg.userId,
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
        const { startOnboarding } = await import("./interactive/onboarding.js");
        await startOnboarding(managed, msg.chatId, msg.userId);
        return;
      }
      if (/^(bots|addbot)$/i.test(stripped)) {
        const { hasPermission } = await import("./config.js");
        if (!hasPermission(msg.userId, "bots")) {
          await adapter
            .sendMessage(msg.chatId, setupMsg(getLang()).noPermission)
            .catch(() => {});
          return;
        }
        const { showBotList } = await import("./interactive/bot-management.js");
        await showBotList(managed, msg.chatId);
        return;
      }
      if (/^config$/i.test(stripped)) {
        const { hasPermission } = await import("./config.js");
        if (!hasPermission(msg.userId, "config")) {
          await adapter
            .sendMessage(msg.chatId, setupMsg(getLang()).noPermission)
            .catch(() => {});
          return;
        }
        const { showGlobalConfig } =
          await import("./interactive/config-editor.js");
        await showGlobalConfig(managed, msg.chatId);
        return;
      }
      if (/^users$/i.test(stripped)) {
        const { hasPermission } = await import("./config.js");
        if (!hasPermission(msg.userId, "users")) {
          await adapter
            .sendMessage(msg.chatId, setupMsg(getLang()).noPermission)
            .catch(() => {});
          return;
        }
        const { showUserManagement } =
          await import("./interactive/user-management.js");
        await showUserManagement(managed, msg.chatId, undefined, msg.userId);
        return;
      }

      // Text-only master commands (status, restart, cron, search) — admin only
      if (!isAdmin(msg.userId)) return;
      const { handleMasterCommand } = await import("./commands.js");
      const directReply = handleMasterCommand(stripped, msg.userId);
      if (directReply !== undefined) {
        if (directReply !== null) {
          const { splitMessage } = await import("./helpers.js");
          const { getMessageLimit } = await import("./config.js");
          for (const chunk of splitMessage(directReply, getMessageLimit())) {
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
          .sendMessage(msg.chatId, setupMsg(getLang()).masterOnly(masterName))
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
            ? `\u23F3 \u4F60\u662F\u7B2C ${pos + 1} \u4E2A\uFF0C\u524D\u9762\u8FD8\u6709 ${pos} \u4E2A\u4EFB\u52A1`
            : `\u23F3 You're #${pos + 1} in queue, ${pos} task(s) ahead`,
        )
        .catch(() => {});
      return;
    }

    // Download image if present
    let imagePath: string | undefined;
    if (msg.photoFileId) {
      imagePath = await adapter.downloadFile(msg.photoFileId);
    }

    // Instant acknowledgment — reaction on platforms that support it,
    // otherwise typing indicator (faster than waiting for Claude to start)
    void adapter
      .setReaction(msg.chatId, msg.id, "\uD83D\uDC40")
      .catch(() => {});
    void adapter.sendTyping(msg.chatId).catch(() => {});
    const { invokeClaudeAndReply } = await import("./claude.js");
    void invokeClaudeAndReply(
      managed,
      msg.chatId,
      text,
      imagePath,
      msg.username,
    );
  });

  // ── Callback handler (buttons) ──
  adapter.onCallback(async (event) => {
    const userId = event.userId;
    log(`CB: ${event.data} from ${userId}`);
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
        await adapter.answerCallback(event.id, s.adminOnly).catch(() => {});
        return;
      }
      pendingApprovals.delete(approvalId!);
      pending.resolve(null);
      await adapter
        .editButtons(event.chatId, event.messageId, s.skipped, [])
        .catch(() => {});
      return;
    }

    // approve:yes — only approvers or admins
    if (
      pending.requiredApprovers.length > 0 &&
      !pending.requiredApprovers.includes(userId) &&
      !isAdmin(userId)
    ) {
      await adapter.answerCallback(event.id, s.adminOnly).catch(() => {});
      return;
    }

    if (pending.approvedBy.has(userId)) {
      return;
    }
    pending.approvedBy.add(userId);
    await adapter.answerCallback(event.id).catch(() => {});

    if (pending.requiredApprovers.length === 0) {
      pendingApprovals.delete(approvalId!);
      pending.resolve(WRITE_TOOLS);
      await adapter
        .editButtons(event.chatId, event.messageId, s.authorized, [])
        .catch(() => {});
    } else {
      const allApproved = pending.requiredApprovers.every((id) =>
        pending.approvedBy.has(id),
      );
      const count = pending.approvedBy.size;
      const total = pending.requiredApprovers.length;

      if (allApproved) {
        pendingApprovals.delete(approvalId!);
        pending.resolve(WRITE_TOOLS);
        await adapter
          .editButtons(
            event.chatId,
            event.messageId,
            `${s.authorized} (${count}/${total})`,
            [],
          )
          .catch(() => {});
      } else {
        const lang = getLang();
        const label =
          lang === "zh"
            ? `\u2705 \u5141\u8BB8 (${count}/${total})`
            : `\u2705 Allow (${count}/${total})`;
        await adapter
          .editButtonsOnly(event.chatId, event.messageId, [
            [
              { text: label, data: `approve:yes:${approvalId}` },
              {
                text: lang === "zh" ? "\u274C \u8DF3\u8FC7" : "\u274C Skip",
                data: `approve:no:${approvalId}`,
              },
            ],
          ])
          .catch(() => {});
      }
    }
  });
}
