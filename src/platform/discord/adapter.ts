/**
 * Discord Platform Adapter — wraps discord.js Client into the Platform interface.
 */
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type Message,
  type Interaction,
} from "discord.js";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  Platform,
  PlatformMessage,
  CallbackEvent,
  Button,
  BotInfo,
  SentMessage,
  ThreadCapable,
} from "../types.js";
import { INBOX_DIR } from "../../config.js";

export class DiscordAdapter implements Platform, ThreadCapable {
  private client: Client;
  private token: string;
  private messageHandlers: Array<(msg: PlatformMessage) => void> = [];
  private callbackHandlers: Array<(event: CallbackEvent) => void> = [];
  public botId: string = "";

  constructor(token: string) {
    this.token = token;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });
  }

  // ── Lifecycle ──

  async start(onReady: (info: BotInfo) => void): Promise<void> {
    this.client.on("messageCreate", (msg) => {
      if (msg.author.bot) return;
      const platformMsg = this.toMessage(msg);
      for (const h of this.messageHandlers) h(platformMsg);
    });

    this.client.on("interactionCreate", (interaction) => {
      if (!interaction.isButton()) return;
      const event: CallbackEvent = {
        id: interaction.id,
        chatId: interaction.channelId,
        userId: interaction.user.id,
        messageId: interaction.message.id,
        data: interaction.customId,
        messageText: interaction.message.content || undefined,
      };
      for (const h of this.callbackHandlers) h(event);

      // Auto-defer to prevent "interaction failed" — callers update via editButtons
      interaction.deferUpdate().catch(() => {});
    });

    await this.client.login(this.token);

    this.client.once("ready", (c) => {
      this.botId = c.user.id;
      onReady({ username: c.user.username });
    });
  }

  async stop(): Promise<void> {
    await this.client.destroy();
  }

  // ── Messages ──

  async sendMessage(chatId: string, text: string): Promise<SentMessage> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");
    const sent = await (
      channel as { send: (t: string) => Promise<Message> }
    ).send(text);
    return { id: sent.id, chatId };
  }

  async editMessage(
    chatId: string,
    msgId: string,
    text: string,
  ): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (
      channel as { messages: { fetch: (id: string) => Promise<Message> } }
    ).messages.fetch(msgId);
    await msg.edit(text).catch(() => {});
  }

  async deleteMessage(chatId: string, msgId: string): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (
      channel as { messages: { fetch: (id: string) => Promise<Message> } }
    ).messages.fetch(msgId);
    await msg.delete().catch(() => {});
  }

  // ── Buttons ──

  async sendButtons(
    chatId: string,
    text: string,
    buttons: Button[][],
  ): Promise<SentMessage> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");
    const components = this.toActionRows(buttons);
    const sent = await (
      channel as { send: (opts: unknown) => Promise<Message> }
    ).send({
      content: text,
      components,
    });
    return { id: sent.id, chatId };
  }

  async editButtons(
    chatId: string,
    msgId: string,
    text: string,
    buttons: Button[][],
  ): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (
      channel as { messages: { fetch: (id: string) => Promise<Message> } }
    ).messages.fetch(msgId);
    const components = buttons.length > 0 ? this.toActionRows(buttons) : [];
    await msg.edit({ content: text, components }).catch(() => {});
  }

  async editButtonsOnly(
    chatId: string,
    msgId: string,
    buttons: Button[][],
  ): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (
      channel as { messages: { fetch: (id: string) => Promise<Message> } }
    ).messages.fetch(msgId);
    const components = buttons.length > 0 ? this.toActionRows(buttons) : [];
    await msg.edit({ components }).catch(() => {});
  }

  // ── Feedback ──

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    // Discord buttons are auto-deferred in the interaction handler.
    // If text is provided, we could follow up, but Discord doesn't have
    // a toast-style callback answer like Telegram. Skip silently.
  }

  async sendTyping(chatId: string): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (channel && channel.isTextBased() && "sendTyping" in channel) {
      await (channel as { sendTyping: () => Promise<void> })
        .sendTyping()
        .catch(() => {});
    }
  }

  async setReaction(
    chatId: string,
    msgId: string,
    emoji: string,
  ): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (
      channel as { messages: { fetch: (id: string) => Promise<Message> } }
    ).messages.fetch(msgId);
    await msg.react(emoji).catch(() => {});
  }

  async pinMessage(chatId: string, msgId: string): Promise<void> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (
      channel as { messages: { fetch: (id: string) => Promise<Message> } }
    ).messages.fetch(msgId);
    await msg.pin().catch(() => {});
  }

  // ── Files ──

  async downloadFile(fileId: string): Promise<string | undefined> {
    // fileId is a URL for Discord attachments
    try {
      mkdirSync(INBOX_DIR, { recursive: true });
      const res = await fetch(fileId);
      if (!res.ok) return undefined;
      const buf = Buffer.from(await res.arrayBuffer());
      const urlPath = new URL(fileId).pathname;
      const rawExt = urlPath.split(".").pop() ?? "bin";
      const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin";
      const path = join(INBOX_DIR, `${Date.now()}.${ext}`);
      writeFileSync(path, buf);
      return path;
    } catch {
      return undefined;
    }
  }

  // ── Thread support (Discord native) ──

  async createThread(
    chatId: string,
    parentMsgId: string,
    title: string,
  ): Promise<string> {
    const channel = await this.client.channels.fetch(chatId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("Cannot create thread in this channel");
    }
    const msg = await channel.messages.fetch(parentMsgId);
    const thread = await msg.startThread({ name: title.slice(0, 100) });
    return thread.id;
  }

  async sendToThread(threadId: string, text: string): Promise<SentMessage> {
    const thread = await this.client.channels.fetch(threadId);
    if (!thread || !thread.isThread()) throw new Error("Invalid thread");
    const sent = await thread.send(text);
    return { id: sent.id, chatId: threadId };
  }

  // ── Events ──

  onMessage(handler: (msg: PlatformMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onCallback(handler: (event: CallbackEvent) => void): void {
    this.callbackHandlers.push(handler);
  }

  // ── Internals ──

  private toActionRows(buttons: Button[][]): ActionRowBuilder<ButtonBuilder>[] {
    return buttons
      .filter((row) => row.length > 0)
      .map((row) => {
        const actionRow = new ActionRowBuilder<ButtonBuilder>();
        for (const btn of row) {
          actionRow.addComponents(
            new ButtonBuilder()
              .setCustomId(btn.data)
              .setLabel(btn.text.slice(0, 80))
              .setStyle(ButtonStyle.Secondary),
          );
        }
        return actionRow;
      });
  }

  private toMessage(msg: Message): PlatformMessage {
    // Extract photo (first image attachment)
    const imageAttachment = msg.attachments.find((a) =>
      a.contentType?.startsWith("image/"),
    );

    // Extract reply
    let replyTo: PlatformMessage | undefined;
    if (msg.reference?.messageId) {
      replyTo = {
        id: msg.reference.messageId,
        chatId: msg.channelId,
        userId: "",
        text: undefined, // Discord doesn't include reply content in the message object
      };
    }

    // Build mention entities from Discord mentions
    const entities: PlatformMessage["entities"] = [];
    for (const mention of msg.mentions.users.values()) {
      const mentionStr = `<@${mention.id}>`;
      const offset = msg.content.indexOf(mentionStr);
      if (offset >= 0) {
        entities.push({
          type: "mention",
          offset,
          length: mentionStr.length,
        });
      }
    }

    return {
      id: msg.id,
      chatId: msg.channelId,
      userId: msg.author.id,
      username: msg.author.username,
      firstName: msg.author.displayName ?? msg.author.username,
      text: msg.content || undefined,
      photoFileId: imageAttachment?.url,
      entities: entities.length > 0 ? entities : undefined,
      replyTo,
      raw: msg,
    };
  }
}
