import type { ReactionTypeEmoji } from "grammy/types";
import type { ManagedBot } from "./types.js";
import { canUseBot, isAdmin, loadPool, WRITE_TOOLS } from "./config.js";
import { log } from "./logger.js";
import {
  splitMessage,
  downloadPhoto,
  transcribeVoice,
} from "./helpers.js";
import { pendingApprovals } from "./state.js";
import { invokeClaudeAndReply } from "./claude.js";
import { handleMasterCommand } from "./commands.js";

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

  // Approval callback handler (approve mode)
  tgBot.on("callback_query:data", async (ctx) => {
    if (!ctx.from || !isAdmin(String(ctx.from.id))) {
      await ctx.answerCallbackQuery({ text: "\u26d4 \u4ec5\u7ba1\u7406\u5458\u53ef\u64cd\u4f5c" });
      return;
    }
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("approve:")) return;

    const [, action, approvalId] = data.split(":");
    const pending = pendingApprovals.get(approvalId!);
    if (!pending) {
      await ctx.answerCallbackQuery({ text: "\u23f0 \u5df2\u8fc7\u671f" });
      return;
    }

    pendingApprovals.delete(approvalId!);
    const approved = action === "yes";
    pending.resolve(approved ? WRITE_TOOLS : null);

    const label = approved
      ? "\u2705 \u5df2\u6388\u6743\uff0c\u91cd\u65b0\u6267\u884c\u4e2d..."
      : "\u274c \u5df2\u8df3\u8fc7";
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
      await ctx.reply("\u23f3 \u6b63\u5728\u5904\u7406\u4e0a\u4e00\u6761\u6d88\u606f...").catch(() => {});
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
      await ctx.reply("\u23f3 \u6b63\u5728\u5904\u7406\u4e0a\u4e00\u6761\u6d88\u606f...").catch(() => {});
      return;
    }

    void tgBot.api
      .setMessageReaction(chatId, ctx.message.message_id, [
        { type: "emoji", emoji: "\ud83c\udfa7" as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});

    const statusMsg = await tgBot.api
      .sendMessage(chatId, "\ud83c\udfa4 \u6b63\u5728\u8bc6\u522b\u8bed\u97f3...")
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
            "\u26a0\ufe0f \u8bed\u97f3\u8bc6\u522b\u5931\u8d25",
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
          `\ud83c\udfa4 \u8bc6\u522b\u7ed3\u679c: ${result.text}`,
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

    // Master bot: direct commands
    if (config.role === "master") {
      const stripped = text.replace(/@\w+/g, "").trim();
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
      // masterExecute disabled — master only handles built-in commands
      return;
    }

    if (!config.assignedPath) {
      await ctx
        .reply(`\u26a0\ufe0f @${botName} \u5c1a\u672a\u7ed1\u5b9a\u9879\u76ee`)
        .catch(() => {});
      return;
    }

    if (managed.busy) {
      await ctx.reply("\u23f3 \u6b63\u5728\u5904\u7406\u4e0a\u4e00\u6761\u6d88\u606f...").catch(() => {});
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
    const replyMsg = ctx.message.reply_to_message as Record<string, unknown> | undefined;
    if (replyMsg) {
      const quotedText =
        (replyMsg.text as string) ?? (replyMsg.caption as string) ?? "";
      const parts: string[] = [];

      if (quotedText) parts.push(`\u6587\u5b57: ${quotedText}`);

      // Quoted photo
      const replyPhotos = replyMsg.photo as Array<{ file_id: string }> | undefined;
      if (replyPhotos?.length) {
        const best = replyPhotos[replyPhotos.length - 1];
        quotedImagePath = await downloadPhoto(
          tgBot.api,
          config.token,
          best.file_id,
        );
        if (quotedImagePath) parts.push(`\u56fe\u7247: ${quotedImagePath}`);
      }

      // Quoted document/file
      const replyDoc = replyMsg.document as {
        file_name?: string;
        mime_type?: string;
      } | undefined;
      if (replyDoc) {
        parts.push(
          `\u6587\u4ef6: ${replyDoc.file_name ?? "\u672a\u77e5"} (${replyDoc.mime_type ?? ""})`,
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
        if (voiceResult?.text) parts.push(`\u8bed\u97f3\u5185\u5bb9: ${voiceResult.text}`);
      }

      // Quoted video note / sticker
      if (replyMsg.video_note) parts.push(`[\u89c6\u9891\u6d88\u606f]`);
      const replySticker = replyMsg.sticker as { emoji?: string } | undefined;
      if (replySticker)
        parts.push(`[\u8d34\u7eb8: ${replySticker.emoji ?? ""}]`);

      if (parts.length > 0) {
        fullText = `[\u5f15\u7528\u6d88\u606f]\n${parts.join("\n")}\n\n${text}`;
      }
    }

    void invokeClaudeAndReply(managed, chatId, fullText, quotedImagePath);
  });

  tgBot.catch((err) => {
    log(`BOT_ERROR: ${config.username ?? "?"} — ${err.error}`);
  });
}
