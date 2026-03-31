import type { ManagedBot } from "./types.js";
import {
  canUseBot,
  isAdmin,
  loadPool,
  getMasterName,
  WRITE_TOOLS,
  MAX_QUEUE_SIZE,
} from "./config.js";
import { log } from "./logger.js";
import { splitMessage, downloadPhoto, transcribeVoice } from "./helpers.js";
import { pendingApprovals, delegatedApprovers } from "./state.js";
import { invokeClaudeAndReply } from "./claude.js";
import { handleMasterCommand } from "./commands.js";
import { handleBotSlashCommand } from "./bot-commands.js";
import {
  routeCallback,
  routeText,
  showMainMenu,
  getLang,
} from "./interactive/index.js";
import { startOnboarding } from "./interactive/onboarding.js";
import { showBotList } from "./interactive/bot-management.js";
import { showGlobalConfig } from "./interactive/config-editor.js";
import { showUserManagement } from "./interactive/user-management.js";
import { setupMsg } from "./interactive/i18n.js";

// ── Build context from a quoted/replied message ──
async function buildQuotedContext(
  replyMsg: Record<string, unknown>,
  tgBot: ManagedBot["bot"],
  config: ManagedBot["config"],
): Promise<{ text: string; imagePath?: string }> {
  const quotedText =
    (replyMsg.text as string) ?? (replyMsg.caption as string) ?? "";
  const parts: string[] = [];
  let imagePath: string | undefined;

  if (quotedText) parts.push(`Text: ${quotedText}`);

  // Quoted photo
  const replyPhotos = replyMsg.photo as Array<{ file_id: string }> | undefined;
  if (replyPhotos?.length) {
    const best = replyPhotos[replyPhotos.length - 1];
    imagePath = await downloadPhoto(tgBot.api, config.token, best.file_id);
    if (imagePath) parts.push(`Image: ${imagePath}`);
  }

  // Quoted document/file
  const replyDoc = replyMsg.document as
    | { file_name?: string; mime_type?: string }
    | undefined;
  if (replyDoc) {
    parts.push(
      `File: ${replyDoc.file_name ?? "unknown"} (${replyDoc.mime_type ?? ""})`,
    );
  }

  // Quoted voice
  const replyVoice = replyMsg.voice as { file_id: string } | undefined;
  if (replyVoice) {
    const voiceResult = await transcribeVoice(
      tgBot.api,
      config.token,
      replyVoice.file_id,
    );
    if (voiceResult?.text) parts.push(`Voice: ${voiceResult.text}`);
  }

  // Quoted video note / sticker
  if (replyMsg.video_note) parts.push(`[Video message]`);
  const replySticker = replyMsg.sticker as { emoji?: string } | undefined;
  if (replySticker) parts.push(`[Sticker: ${replySticker.emoji ?? ""}]`);

  return {
    text: parts.length > 0 ? `[Quoted message]\n${parts.join("\n")}` : "",
    imagePath,
  };
}

export function setupBot(managed: ManagedBot): void {
  const { bot: tgBot, config, platform } = managed;
  const botName = config.username ?? "";

  tgBot.use((ctx, next) => {
    const from = ctx.from;
    const text = ctx.message?.text ?? ctx.message?.caption ?? "";
    if (ctx.message) {
      const userId = String(from?.id ?? "");
      const authorized = canUseBot(userId, config);
      log(
        `RAW: @${botName} \u2190 [${ctx.chat?.type}] ${from?.username ?? "?"}(${userId}) auth=${authorized}: ${text.slice(0, 60)}`,
      );
    }
    return next();
  });

  // Auto-detect: master bot added to a group while sharedGroupId is empty
  if (config.role === "master") {
    tgBot.on("my_chat_member", async (ctx) => {
      const chat = ctx.myChatMember.chat;
      if (chat.type !== "group" && chat.type !== "supergroup") return;

      const newStatus = ctx.myChatMember.new_chat_member.status;
      if (newStatus !== "member" && newStatus !== "administrator") return;

      const pool = loadPool();
      if (pool.sharedGroupId) return; // already bound

      const lang = getLang();
      const { onboardMsg, common: commonMsg } =
        await import("./interactive/i18n.js");
      const m = onboardMsg(lang);
      const c = commonMsg(lang);
      const chatId = String(chat.id);

      if (newStatus === "member") {
        // Added as regular member → ask for admin rights
        await platform.sendMessage(chatId, m.needAdmin).catch(() => {});
      } else if (newStatus === "administrator") {
        // Promoted to admin → offer to bind group
        await platform
          .sendButtons(chatId, m.groupDetected, [
            [
              { text: `\u2705 ${m.yesUseGroup}`, data: "o:setgroup" },
              { text: `\u274c ${c.cancel}`, data: "o:cancel" },
            ],
          ])
          .catch(() => {});
      }
    });
  }

  // Callback handler: interactive setup + approval
  tgBot.on("callback_query:data", async (ctx) => {
    if (!ctx.from) return;
    const data = ctx.callbackQuery.data;
    const cbId = ctx.callbackQuery.id;
    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat?.id ?? ctx.from.id);
    const messageId = ctx.callbackQuery.message?.message_id ?? 0;

    // Interactive setup callbacks (o:, b:, c:, u:)
    if (config.role === "master") {
      const handled = await routeCallback(
        managed,
        chatId,
        userId,
        data,
        messageId,
      );
      if (handled) {
        await platform.answerCallback(cbId).catch(() => {});
        return;
      }
    }

    // Approval callbacks (approve:yes:id / approve:no:id)
    // Check: admin OR delegated approver
    const isDelegated = (() => {
      const expires = delegatedApprovers.get(userId);
      if (!expires) return false;
      if (Date.now() > expires) {
        delegatedApprovers.delete(userId);
        return false;
      }
      return true;
    })();

    if (!isAdmin(userId) && !isDelegated) {
      const s = setupMsg(getLang());
      await platform.answerCallback(cbId, s.adminOnly);
      return;
    }
    if (!data.startsWith("approve:")) return;

    const [, action, approvalId] = data.split(":");
    const pending = pendingApprovals.get(approvalId!);
    if (!pending) {
      const s = setupMsg(getLang());
      await platform.answerCallback(cbId, s.expired);
      return;
    }

    if (action === "no") {
      pendingApprovals.delete(approvalId!);
      pending.resolve(null);
      const s = setupMsg(getLang());
      await platform.answerCallback(cbId, s.skipped);
      const msg = ctx.callbackQuery.message;
      if (msg && "text" in msg && msg.text) {
        await ctx
          .editMessageText(`${msg.text}\n\n${s.skipped}`, {
            reply_markup: { inline_keyboard: [] },
          })
          .catch(() => {});
      }
      return;
    }

    // Multi-sig: check if user is in approvers list (admins always allowed)
    if (
      pending.requiredApprovers.length > 0 &&
      !pending.requiredApprovers.includes(userId) &&
      !isAdmin(userId)
    ) {
      await platform.answerCallback(cbId, "Not authorized to approve");
      return;
    }

    if (pending.approvedBy.has(userId)) {
      await platform.answerCallback(cbId, "Already approved");
      return;
    }

    pending.approvedBy.add(userId);

    // If no approvers configured, single approval is enough
    if (pending.requiredApprovers.length === 0) {
      pendingApprovals.delete(approvalId!);
      pending.resolve(WRITE_TOOLS);
      const s = setupMsg(getLang());
      await platform.answerCallback(cbId, s.authorized);
      const msg = ctx.callbackQuery.message;
      if (msg && "text" in msg && msg.text) {
        await ctx
          .editMessageText(`${msg.text}\n\n${s.authorized}`, {
            reply_markup: { inline_keyboard: [] },
          })
          .catch(() => {});
      }
    } else {
      // Multi-sig: check if all required approvers have approved
      const allApproved = pending.requiredApprovers.every((id) =>
        pending.approvedBy.has(id),
      );
      const count = pending.approvedBy.size;
      const total = pending.requiredApprovers.length;

      if (allApproved) {
        pendingApprovals.delete(approvalId!);
        pending.resolve(WRITE_TOOLS);
        const s = setupMsg(getLang());
        const label = `${s.authorized} (${count}/${total})`;
        await platform.answerCallback(cbId, label);
        const msg = ctx.callbackQuery.message;
        if (msg && "text" in msg && msg.text) {
          await ctx
            .editMessageText(`${msg.text}\n\n${label}`, {
              reply_markup: { inline_keyboard: [] },
            })
            .catch(() => {});
        }
        return;
      }

      const lang = getLang();
      const label =
        lang === "zh"
          ? `✅ 允许 (${count}/${total})`
          : `✅ Allow (${count}/${total})`;
      await platform.answerCallback(cbId, `${count}/${total}`);
      await ctx
        .editMessageReplyMarkup({
          reply_markup: {
            inline_keyboard: [
              [
                { text: label, callback_data: `approve:yes:${approvalId}` },
                {
                  text: lang === "zh" ? "❌ 跳过" : "❌ Skip",
                  callback_data: `approve:no:${approvalId}`,
                },
              ],
            ],
          },
        })
        .catch(() => {});
    }
  });

  // Photo handler
  tgBot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;
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

    if (!canUseBot(String(ctx.from.id), config)) {
      await platform
        .sendMessage(chatId, setupMsg(getLang()).noPermission)
        .catch(() => {});
      return;
    }

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const imagePath = await platform.downloadFile(best.file_id);

    if (managed.busy) {
      if (managed.queue.length >= MAX_QUEUE_SIZE) {
        await ctx
          .reply(
            setupMsg(getLang()).queueFull(
              managed.queue.length + 1,
              MAX_QUEUE_SIZE,
            ),
          )
          .catch(() => {});
        return;
      }
      managed.queue.push({
        chatId,
        userId: String(ctx.from.id),
        message: text,
        imagePath,
        queuedAt: Date.now(),
        requesterName: ctx.from.username ?? ctx.from.first_name,
      });
      const pos = managed.queue.length;
      const lang = getLang();
      const hint =
        lang === "zh"
          ? `⏳ 你是第 ${pos + 1} 个，前面还有 ${pos} 个任务`
          : `⏳ You're #${pos + 1} in queue, ${pos} task(s) ahead`;
      await platform.sendMessage(chatId, hint).catch(() => {});
      return;
    }

    void platform
      .setReaction(chatId, String(ctx.message.message_id), "\ud83d\udc40")
      .catch(() => {});

    void invokeClaudeAndReply(
      managed,
      chatId,
      text,
      imagePath,
      ctx.from.username ?? ctx.from.first_name,
    );
  });

  // Voice handler
  tgBot.on("message:voice", async (ctx) => {
    if (!ctx.from) return;
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

    if (!canUseBot(String(ctx.from.id), config)) {
      await platform
        .sendMessage(chatId, setupMsg(getLang()).noPermission)
        .catch(() => {});
      return;
    }

    void platform
      .setReaction(chatId, String(ctx.message.message_id), "\ud83c\udfa7")
      .catch(() => {});

    const sv = setupMsg(getLang());
    const statusMsg = await platform
      .sendMessage(chatId, sv.transcribing)
      .catch(() => null);

    const result = await transcribeVoice(
      tgBot.api,
      config.token,
      ctx.message.voice.file_id,
    );
    if (!result || !result.text) {
      if (statusMsg) {
        await platform
          .editMessage(chatId, statusMsg.id, sv.transcribeFailed)
          .catch(() => {});
      }
      return;
    }

    if (statusMsg) {
      await platform
        .editMessage(chatId, statusMsg.id, sv.transcription(result.text))
        .catch(() => {});
    }

    if (managed.busy) {
      if (managed.queue.length < MAX_QUEUE_SIZE) {
        managed.queue.push({
          chatId,
          userId: String(ctx.from.id),
          message: result.text,
          queuedAt: Date.now(),
          requesterName: ctx.from.username ?? ctx.from.first_name,
        });
        const pos = managed.queue.length;
        const lang = getLang();
        const hint =
          lang === "zh"
            ? `⏳ 语音已转写，排队中（第 ${pos + 1} 个）`
            : `⏳ Voice transcribed, queued (#${pos + 1})`;
        await platform.sendMessage(chatId, hint).catch(() => {});
      } else {
        await platform.sendMessage(chatId, sv.busy).catch(() => {});
      }
      return;
    }

    void invokeClaudeAndReply(
      managed,
      chatId,
      result.text,
      undefined,
      ctx.from.username ?? ctx.from.first_name,
    );
  });

  // Text handler
  tgBot.on("message:text", async (ctx) => {
    if (!ctx.from) return;

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

    if (!canUseBot(String(ctx.from.id), config)) {
      await platform
        .sendMessage(chatId, setupMsg(getLang()).noPermission)
        .catch(() => {});
      return;
    }

    // Master bot: interactive conversations + commands
    if (config.role === "master") {
      const userId = String(ctx.from.id);

      // No group bound yet → guide user
      if (!loadPool().sharedGroupId) {
        if (chatType === "private") {
          // DM: tell user to add bot to group
          const { onboardMsg: ob } = await import("./interactive/i18n.js");
          await platform
            .sendMessage(chatId, ob(getLang()).dmOnly)
            .catch(() => {});
          return;
        }
        // In a group but not bound → auto-trigger setup
        await startOnboarding(managed, chatId, userId);
        return;
      }

      // Check active interactive conversation first (text input)
      const interactiveHandled = await routeText(
        managed,
        chatId,
        userId,
        text.replace(/@\w+/g, "").trim(),
      );
      if (interactiveHandled) return;

      // Interactive commands (button-driven)
      // Strip @mentions and /command prefix
      const stripped = text.replace(/@\w+/g, "").trim().replace(/^\//, "");
      if (/^(help|menu|start)$/i.test(stripped)) {
        await showMainMenu(managed, chatId);
        return;
      }
      if (/^setup$/i.test(stripped)) {
        await startOnboarding(managed, chatId, userId);
        return;
      }
      if (/^(bots|addbot)$/i.test(stripped)) {
        await showBotList(managed, chatId);
        return;
      }
      if (/^config$/i.test(stripped)) {
        await showGlobalConfig(managed, chatId);
        return;
      }
      if (/^users$/i.test(stripped)) {
        await showUserManagement(managed, chatId);
        return;
      }

      // Text-only master commands (search, cron, restart, status)
      const directReply = handleMasterCommand(stripped);
      if (directReply !== undefined) {
        if (directReply !== null) {
          for (const chunk of splitMessage(directReply)) {
            await platform.sendMessage(chatId, chunk).catch(() => {});
          }
        }
        return;
      }
    }

    if (config.role === "master" && !loadPool().masterExecute) {
      // Unrecognized input → show menu with buttons
      await showMainMenu(managed, chatId);
      return;
    }

    // Project bot: intercept master-only commands
    if (config.role !== "master") {
      const stripped = text.replace(/@\w+/g, "").trim();
      if (
        /^cron\s/i.test(stripped) ||
        /^(help|setup|bots|config|users|restart|search\s)$/i.test(stripped)
      ) {
        const pool = loadPool();
        const masterName = getMasterName(pool);
        await ctx
          .reply(setupMsg(getLang()).masterOnly(masterName))
          .catch(() => {});
        return;
      }
    }

    // Project bot slash commands (/new, /compact, /model, /effort, /cost, /memory, /status)
    {
      const cmdText = text.replace(/@\w+/g, "").trim().replace(/^\//, "");
      const handled = await handleBotSlashCommand(managed, chatId, cmdText);
      if (handled) return;
    }

    if (!config.assignedPath && config.role !== "master") {
      await platform
        .sendMessage(chatId, setupMsg(getLang()).noProject(botName))
        .catch(() => {});
      return;
    }

    // Build full text (with quoted context) before busy check — needed for queue
    let fullText = text;
    let quotedImagePath: string | undefined;
    const replyMsg = ctx.message.reply_to_message as
      | Record<string, unknown>
      | undefined;
    if (replyMsg) {
      const quoted = await buildQuotedContext(replyMsg, tgBot, config);
      quotedImagePath = quoted.imagePath;
      if (quoted.text) {
        fullText = `${quoted.text}\n\n${text}`;
      }
    }

    // Queue or execute
    if (managed.busy) {
      if (managed.queue.length >= MAX_QUEUE_SIZE) {
        const s = setupMsg(getLang());
        await platform
          .sendMessage(
            chatId,
            s.queueFull(managed.queue.length + 1, MAX_QUEUE_SIZE),
          )
          .catch(() => {});
        return;
      }
      managed.queue.push({
        chatId,
        userId: String(ctx.from.id),
        message: fullText,
        imagePath: quotedImagePath,
        queuedAt: Date.now(),
        requesterName: ctx.from.username ?? ctx.from.first_name,
      });
      const pos = managed.queue.length;
      const lang = getLang();
      const hint =
        lang === "zh"
          ? `⏳ 你是第 ${pos + 1} 个，前面还有 ${pos} 个任务\n💡 并发上限可在 menu → 配置 → maxConcurrent 中调整`
          : `⏳ You're #${pos + 1} in queue, ${pos} task(s) ahead\n💡 Adjust limit in menu → Config → maxConcurrent`;
      await platform.sendMessage(chatId, hint).catch(() => {});
      return;
    }

    // Ack
    void platform
      .setReaction(chatId, String(msgId), "\ud83d\udc40")
      .catch(() => {});

    void invokeClaudeAndReply(
      managed,
      chatId,
      fullText,
      quotedImagePath,
      ctx.from.username ?? ctx.from.first_name,
    );
  });

  tgBot.catch((err) => {
    log(`BOT_ERROR: ${config.username ?? "?"} — ${err.error}`);
  });
}
