/**
 * Telegram Platform Adapter — wraps grammY Bot into the Platform interface.
 */
import { Bot, GrammyError } from "grammy";
import type { ReactionTypeEmoji } from "grammy/types";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  Platform,
  PlatformMessage,
  CallbackEvent,
  Button,
  BotInfo,
  SentMessage,
} from "../types.js";
import { INBOX_DIR } from "../../config.js";

export class TelegramAdapter implements Platform {
  private bot: Bot;
  private token: string;
  private messageHandlers: Array<(msg: PlatformMessage) => void> = [];
  private callbackHandlers: Array<(event: CallbackEvent) => void> = [];
  private botAddedHandlers: Array<
    (chatId: string, chatType: string, status: string) => void
  > = [];

  constructor(token: string) {
    this.token = token;
    this.bot = new Bot(token);
  }

  /** Expose underlying grammY Bot for middleware/advanced use */
  get raw(): Bot {
    return this.bot;
  }

  // ── Lifecycle ──

  async start(onReady: (info: BotInfo) => void): Promise<void> {
    // Register internal event routing
    this.bot.on("message", (ctx) => {
      if (!ctx.from) return;
      const msg = this.toMessage(ctx);
      for (const h of this.messageHandlers) h(msg);
    });

    this.bot.on("callback_query:data", (ctx) => {
      if (!ctx.from) return;
      const event: CallbackEvent = {
        id: ctx.callbackQuery.id,
        chatId: String(ctx.chat?.id ?? ctx.from.id),
        userId: String(ctx.from.id),
        messageId: String(ctx.callbackQuery.message?.message_id ?? 0),
        data: ctx.callbackQuery.data,
        messageText:
          ctx.callbackQuery.message &&
          "text" in ctx.callbackQuery.message
            ? ctx.callbackQuery.message.text
            : undefined,
      };
      for (const h of this.callbackHandlers) h(event);
    });

    this.bot.on("my_chat_member", (ctx) => {
      const chat = ctx.myChatMember.chat;
      const status = ctx.myChatMember.new_chat_member.status;
      for (const h of this.botAddedHandlers) {
        h(String(chat.id), chat.type, status);
      }
    });

    this.bot.catch((err) => {
      const username = err.ctx?.me?.username ?? "?";
      // Suppress expected errors, log unexpected ones
      if (!(err.error instanceof GrammyError)) {
        console.error(`BOT_ERROR: ${username} — ${err.error}`);
      }
    });

    await this.bot.start({
      drop_pending_updates: true,
      onStart: (info) => onReady({ username: info.username }),
    });
  }

  async stop(): Promise<void> {
    await this.bot.stop().catch(() => {});
  }

  // ── Messages ──

  async sendMessage(chatId: string, text: string): Promise<SentMessage> {
    const sent = await this.bot.api.sendMessage(chatId, text);
    return { id: String(sent.message_id), chatId };
  }

  async editMessage(
    chatId: string,
    msgId: string,
    text: string,
  ): Promise<void> {
    await this.bot.api
      .editMessageText(chatId, Number(msgId), text)
      .catch(() => {});
  }

  async deleteMessage(chatId: string, msgId: string): Promise<void> {
    await this.bot.api.deleteMessage(chatId, Number(msgId)).catch(() => {});
  }

  // ── Buttons ──

  async sendButtons(
    chatId: string,
    text: string,
    buttons: Button[][],
  ): Promise<SentMessage> {
    const sent = await this.bot.api.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: this.toInlineKeyboard(buttons) },
    });
    return { id: String(sent.message_id), chatId };
  }

  async editButtons(
    chatId: string,
    msgId: string,
    text: string,
    buttons: Button[][],
  ): Promise<void> {
    await this.bot.api
      .editMessageText(chatId, Number(msgId), text, {
        reply_markup: { inline_keyboard: this.toInlineKeyboard(buttons) },
      })
      .catch(() => {});
  }

  async editButtonsOnly(
    chatId: string,
    msgId: string,
    buttons: Button[][],
  ): Promise<void> {
    await this.bot.api
      .editMessageReplyMarkup(chatId, Number(msgId), {
        reply_markup: { inline_keyboard: this.toInlineKeyboard(buttons) },
      })
      .catch(() => {});
  }

  // ── Feedback ──

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.bot.api
      .answerCallbackQuery(callbackId, text ? { text } : undefined)
      .catch(() => {});
  }

  async sendTyping(chatId: string): Promise<void> {
    await this.bot.api.sendChatAction(chatId, "typing").catch(() => {});
  }

  async setReaction(
    chatId: string,
    msgId: string,
    emoji: string,
  ): Promise<void> {
    await this.bot.api
      .setMessageReaction(chatId, Number(msgId), [
        { type: "emoji", emoji: emoji as ReactionTypeEmoji["emoji"] },
      ])
      .catch(() => {});
  }

  async pinMessage(chatId: string, msgId: string): Promise<void> {
    await this.bot.api
      .pinChatMessage(chatId, Number(msgId), {
        disable_notification: true,
      })
      .catch(() => {});
  }

  // ── Files ──

  async downloadFile(fileId: string): Promise<string | undefined> {
    try {
      mkdirSync(INBOX_DIR, { recursive: true });
      const file = await this.bot.api.getFile(fileId);
      if (!file.file_path) return undefined;
      const url = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = file.file_path.split(".").pop() ?? "jpg";
      const path = join(INBOX_DIR, `${Date.now()}.${ext}`);
      writeFileSync(path, buf);
      return path;
    } catch {
      return undefined;
    }
  }

  // ── Events ──

  onMessage(handler: (msg: PlatformMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onCallback(handler: (event: CallbackEvent) => void): void {
    this.callbackHandlers.push(handler);
  }

  onBotAdded(
    handler: (chatId: string, chatType: string, status: string) => void,
  ): void {
    this.botAddedHandlers.push(handler);
  }

  // ── Telegram command menu ──

  async setCommandMenu(
    commands: Array<{ command: string; description: string }>,
  ): Promise<void> {
    await this.bot.api.setMyCommands(commands).catch(() => {});
  }

  // ── Internals ──

  private toInlineKeyboard(
    buttons: Button[][],
  ): Array<Array<{ text: string; callback_data: string }>> {
    return buttons.map((row) =>
      row.map((b) => ({ text: b.text, callback_data: b.data })),
    );
  }

  private toMessage(ctx: {
    from?: { id: number; username?: string; first_name?: string };
    chat?: { id: number; type: string };
    message?: Record<string, unknown>;
  }): PlatformMessage {
    const msg = ctx.message as Record<string, unknown> | undefined;
    const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? "");

    // Extract reply-to message
    let replyTo: PlatformMessage | undefined;
    const replyRaw = msg?.reply_to_message as
      | Record<string, unknown>
      | undefined;
    if (replyRaw) {
      const replyFrom = replyRaw.from as
        | { id: number; username?: string; first_name?: string }
        | undefined;
      replyTo = {
        id: String((replyRaw.message_id as number) ?? 0),
        chatId,
        userId: String(replyFrom?.id ?? ""),
        username: replyFrom?.username,
        firstName: replyFrom?.first_name,
        text: (replyRaw.text as string) ?? (replyRaw.caption as string),
        raw: replyRaw,
      };
    }

    // Extract photo (best quality = last in array)
    const photos = msg?.photo as Array<{ file_id: string }> | undefined;
    const photoFileId = photos?.length
      ? photos[photos.length - 1].file_id
      : undefined;

    // Extract voice
    const voice = msg?.voice as { file_id: string } | undefined;

    return {
      id: String((msg?.message_id as number) ?? 0),
      chatId,
      userId: String(ctx.from?.id ?? ""),
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      text: (msg?.text as string) ?? undefined,
      caption: (msg?.caption as string) ?? undefined,
      photoFileId,
      voiceFileId: voice?.file_id,
      entities: (msg?.entities as PlatformMessage["entities"]) ??
        (msg?.caption_entities as PlatformMessage["entities"]),
      replyTo,
      raw: msg,
    };
  }
}
