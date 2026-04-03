// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Platform abstraction — all messaging platform adapters implement this interface.
 * Core logic (claude.ts, commands.ts, interactive/*) calls these methods,
 * never platform-specific APIs directly.
 */

export interface PlatformMessage {
  id: string;
  chatId: string;
  userId: string;
  username?: string;
  firstName?: string;
  text?: string;
  caption?: string;
  /** Platform-specific file reference for photo */
  photoFileId?: string;
  /** The message this is replying to */
  replyTo?: PlatformMessage;
  /** Text entities (mentions, links, etc.) */
  entities?: Array<{ type: string; offset: number; length: number }>;
  /** Raw platform-specific data for advanced use */
  raw?: unknown;
}

export interface Button {
  text: string;
  data: string;
}

export interface CallbackEvent {
  /** Callback query ID (for answering) */
  id: string;
  chatId: string;
  userId: string;
  /** Message ID the button was on */
  messageId: string;
  /** Button callback data string */
  data: string;
  /** Original message text (if available) */
  messageText?: string;
}

export interface BotInfo {
  username: string;
}

export interface SentMessage {
  id: string;
  chatId: string;
}

/**
 * Core platform interface — every adapter must implement these.
 */
export interface Platform {
  // ── Lifecycle ──
  start(onReady: (info: BotInfo) => void): Promise<void>;
  stop(): Promise<void>;

  // ── Messages ──
  sendMessage(chatId: string, text: string): Promise<SentMessage>;
  editMessage(chatId: string, msgId: string, text: string): Promise<void>;
  deleteMessage(chatId: string, msgId: string): Promise<void>;

  // ── Buttons / Interactive ──
  sendButtons(
    chatId: string,
    text: string,
    buttons: Button[][],
  ): Promise<SentMessage>;
  editButtons(
    chatId: string,
    msgId: string,
    text: string,
    buttons: Button[][],
  ): Promise<void>;
  editButtonsOnly(
    chatId: string,
    msgId: string,
    buttons: Button[][],
  ): Promise<void>;

  // ── Feedback ──
  answerCallback(callbackId: string, text?: string): Promise<void>;
  sendTyping(chatId: string): Promise<void>;
  setReaction(chatId: string, msgId: string, emoji: string): Promise<void>;
  pinMessage(chatId: string, msgId: string): Promise<void>;

  // ── Files ──
  /** Download a file by platform file ID, returns local path */
  downloadFile(fileId: string): Promise<string | undefined>;

  // ── Events ──
  onMessage(handler: (msg: PlatformMessage) => void): void;
  onCallback(handler: (event: CallbackEvent) => void): void;
  /** Fired when bot is added to a group/guild */
  onBotAdded?(
    handler: (chatId: string, chatType: string, status: string) => void,
  ): void;
}

/**
 * Optional capabilities — adapters can implement these for richer features.
 * Check with `if ('sendFile' in platform)` before calling.
 */
export interface FileCapable {
  sendFile(chatId: string, path: string, caption?: string): Promise<void>;
}

export interface ThreadCapable {
  createThread(
    chatId: string,
    parentMsgId: string,
    title: string,
  ): Promise<string>; // returns threadId
  sendToThread(threadId: string, text: string): Promise<SentMessage>;
}

export interface CardCapable {
  /** Send a rich card (Lark/Feishu interactive cards) */
  sendCard(chatId: string, card: unknown): Promise<SentMessage>;
}

// ── Type guards for optional capabilities ──

export function hasFileSupport(p: Platform): p is Platform & FileCapable {
  return "sendFile" in p;
}

export function hasThreadSupport(p: Platform): p is Platform & ThreadCapable {
  return "createThread" in p;
}

export function hasCardSupport(p: Platform): p is Platform & CardCapable {
  return "sendCard" in p;
}
