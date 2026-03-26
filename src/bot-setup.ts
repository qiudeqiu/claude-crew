import type { ReactionTypeEmoji } from "grammy/types";
import type { ManagedBot } from "./types.js";
import { canUseBot, isAdmin, loadPool, WRITE_TOOLS } from "./config.js";
import { log } from "./logger.js";
import { splitMessage, downloadPhoto, transcribeVoice } from "./helpers.js";
import { pendingApprovals } from "./state.js";
import { invokeClaudeAndReply } from "./claude.js";
import { handleMasterCommand } from "./commands.js";
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

export function setupBot(managed: ManagedBot): void {
  const { bot: tgBot, config } = managed;
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

  // Callback handler: interactive setup + approval
  tgBot.on("callback_query:data", async (ctx) => {
    if (!ctx.from) return;
    const data = ctx.callbackQuery.data;
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
        await ctx.answerCallbackQuery().catch(() => {});
        return;
      }
    }

    // Approval callbacks
    if (!isAdmin(userId)) {
      await ctx.answerCallbackQuery({ text: "\u26d4 Admin only" });
      return;
    }
    if (!data.startsWith("approve:")) return;

    const [, action, approvalId] = data.split(":");
    const pending = pendingApprovals.get(approvalId!);
    if (!pending) {
      await ctx.answerCallbackQuery({ text: "\u23f0 Expired" });
      return;
    }

    pendingApprovals.delete(approvalId!);
    const approved = action === "yes";
    pending.resolve(approved ? WRITE_TOOLS : null);

    const label = approved
      ? "\u2705 Authorized, retrying..."
      : "\u274c Skipped";
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
      await ctx.reply(setupMsg(getLang()).busy).catch(() => {});
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
        { type: "emoji", emoji: "\ud83d\udc40" as ReactionTypeEmoji["emoji"] },
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
      await ctx.reply(setupMsg(getLang()).busy).catch(() => {});
      return;
    }

    void tgBot.api
      .setMessageReaction(chatId, ctx.message.message_id, [
        { type: "emoji", emoji: "\ud83c\udfa7" as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});

    const statusMsg = await tgBot.api
      .sendMessage(chatId, "\ud83c\udfa4 Transcribing voice...")
      .catch(() => null);

    const result = await transcribeVoice(
      tgBot.api,
      config.token,
      ctx.message.voice.file_id,
    );
    if (!result || !result.text) {
      if (statusMsg) {
        await tgBot.api
          .editMessageText(
            chatId,
            statusMsg.message_id,
            "\u26a0\ufe0f Voice transcription failed",
          )
          .catch(() => {});
      }
      return;
    }

    if (statusMsg) {
      await tgBot.api
        .editMessageText(
          chatId,
          statusMsg.message_id,
          `\ud83c\udfa4 Transcription: ${result.text}`,
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

    // Master bot: interactive conversations + commands
    if (config.role === "master") {
      const userId = String(ctx.from.id);

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
            await tgBot.api.sendMessage(chatId, chunk).catch(() => {});
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
        /^(help|status|setup|bots|config|users|restart|search\s)$/i.test(
          stripped,
        )
      ) {
        const pool = loadPool();
        const masterName =
          pool.bots.find((b) => b.role === "master")?.username ?? "master";
        await ctx
          .reply(setupMsg(getLang()).masterOnly(masterName))
          .catch(() => {});
        return;
      }
    }

    if (!config.assignedPath && config.role !== "master") {
      await ctx.reply(setupMsg(getLang()).noProject(botName)).catch(() => {});
      return;
    }

    if (managed.busy) {
      await ctx.reply(setupMsg(getLang()).busy).catch(() => {});
      return;
    }

    // Ack
    void tgBot.api
      .setMessageReaction(chatId, msgId, [
        { type: "emoji", emoji: "\ud83d\udc40" as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});

    // Include quoted message content if replying to a message
    let fullText = text;
    let quotedImagePath: string | undefined;
    const replyMsg = ctx.message.reply_to_message as
      | Record<string, unknown>
      | undefined;
    if (replyMsg) {
      const quotedText =
        (replyMsg.text as string) ?? (replyMsg.caption as string) ?? "";
      const parts: string[] = [];

      if (quotedText) parts.push(`Text: ${quotedText}`);

      // Quoted photo
      const replyPhotos = replyMsg.photo as
        | Array<{ file_id: string }>
        | undefined;
      if (replyPhotos?.length) {
        const best = replyPhotos[replyPhotos.length - 1];
        quotedImagePath = await downloadPhoto(
          tgBot.api,
          config.token,
          best.file_id,
        );
        if (quotedImagePath) parts.push(`Image: ${quotedImagePath}`);
      }

      // Quoted document/file
      const replyDoc = replyMsg.document as
        | {
            file_name?: string;
            mime_type?: string;
          }
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

      if (parts.length > 0) {
        fullText = `[Quoted message]\n${parts.join("\n")}\n\n${text}`;
      }
    }

    void invokeClaudeAndReply(managed, chatId, fullText, quotedImagePath);
  });

  tgBot.catch((err) => {
    log(`BOT_ERROR: ${config.username ?? "?"} — ${err.error}`);
  });
}
