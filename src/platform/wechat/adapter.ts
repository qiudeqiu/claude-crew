// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat Platform Adapter — wraps iLink Bot API into the Platform interface.
 *
 * Key differences from other adapters:
 * - Single bot connection serves multiple virtual project bots via #tag routing
 * - No native buttons — translated to numbered text menus
 * - Long polling for message receive (like Telegram getUpdates)
 * - context_token tracking for conversation threading
 */

import type {
  Platform,
  PlatformMessage,
  CallbackEvent,
  Button,
  BotInfo,
  SentMessage,
} from "../types.js";
import { WeChatApi } from "./api.js";
import { WeChatRouter } from "./router.js";
import { toMessage, extractTag } from "./events.js";
import {
  renderTextMenu,
  registerMenu,
  matchMenuInput,
  cleanupMenus,
} from "./menus.js";
import type { WeChatMessage } from "./types.js";

const POLL_RETRY_MS = 15_000;
const MENU_CLEANUP_MS = 60_000;

export class WeChatAdapter implements Platform {
  private api: WeChatApi;
  private token: string;
  public router: WeChatRouter;
  private messageHandlers: Array<(msg: PlatformMessage) => void> = [];
  private callbackHandlers: Array<(event: CallbackEvent) => void> = [];
  /** Maps chatId → latest context_token for replying */
  private contextTokens = new Map<string, string>();
  /** Maps chatId → userId for context_token lookup */
  private chatUsers = new Map<string, string>();
  private pollCursor = "";
  private polling = false;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(token: string) {
    this.token = token;
    this.api = new WeChatApi(token);
    this.router = new WeChatRouter();
  }

  // ── Lifecycle ──

  async start(onReady: (info: BotInfo) => void): Promise<void> {
    this.polling = true;

    // Periodic menu cleanup
    this.cleanupTimer = setInterval(cleanupMenus, MENU_CLEANUP_MS);

    // Start poll loop (non-blocking)
    this.pollLoop();

    onReady({ username: "WeChat Bot" });
  }

  async stop(): Promise<void> {
    this.polling = false;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const resp = await this.api.poll(this.pollCursor);
        if (resp.get_updates_buf) {
          this.pollCursor = resp.get_updates_buf;
        }
        for (const raw of resp.msgs ?? []) {
          this.handleMessage(raw);
        }
      } catch (err) {
        console.error(`[wechat] poll error: ${err}`);
        await new Promise((r) => setTimeout(r, POLL_RETRY_MS));
      }
    }
  }

  private handleMessage(raw: WeChatMessage): void {
    // Track context_token
    if (raw.context_token && raw.from_user_id) {
      this.contextTokens.set(raw.from_user_id, raw.context_token);
    }

    const msg = toMessage(raw);
    if (!msg || !msg.text) return;

    // Check for menu number input first
    const menuCb = matchMenuInput(msg.chatId, msg.userId, msg.text);
    if (menuCb) {
      for (const h of this.callbackHandlers) h(menuCb);
      return;
    }

    // Extract #tag and attach to message
    const { tag, cleanText } = extractTag(msg.text);
    if (tag || cleanText !== msg.text) {
      (msg as PlatformMessage & { _wechatTag?: string })._wechatTag = tag ?? undefined;
      msg.text = cleanText;
    }

    for (const h of this.messageHandlers) h(msg);
  }

  // ── Messages ──

  async sendMessage(chatId: string, text: string): Promise<SentMessage> {
    const ctx = this.contextTokens.get(chatId);
    if (!ctx) {
      console.error(`[wechat] no context_token for ${chatId}, cannot send`);
      return { id: "", chatId };
    }
    await this.api.send(chatId, text, ctx);
    return { id: `${Date.now()}`, chatId };
  }

  async editMessage(): Promise<void> {
    // WeChat has no edit API — no-op
  }

  async deleteMessage(): Promise<void> {
    // WeChat has no delete API — no-op
  }

  // ── Buttons / Interactive (text-menu emulation) ──

  async sendButtons(
    chatId: string,
    text: string,
    buttons: Button[][],
  ): Promise<SentMessage> {
    const rendered = renderTextMenu(text, buttons);
    const sent = await this.sendMessage(chatId, rendered);
    registerMenu(chatId, buttons);
    return sent;
  }

  async editButtons(
    chatId: string,
    _msgId: string,
    text: string,
    buttons: Button[][],
  ): Promise<void> {
    // Can't edit — send new menu
    await this.sendButtons(chatId, text, buttons);
  }

  async editButtonsOnly(
    chatId: string,
    _msgId: string,
    buttons: Button[][],
  ): Promise<void> {
    if (buttons.length > 0) {
      await this.sendButtons(chatId, "", buttons);
    }
  }

  // ── Feedback ──

  async answerCallback(): Promise<void> {
    // No-op — synthetic callbacks, nothing to answer
  }

  async sendTyping(chatId: string): Promise<void> {
    const ctx = this.contextTokens.get(chatId);
    if (ctx) await this.api.sendTyping(ctx);
  }

  async setReaction(): Promise<void> {
    // WeChat has no reaction API
  }

  async pinMessage(): Promise<void> {
    // WeChat has no pin API
  }

  // ── Files ──

  async downloadFile(): Promise<string | undefined> {
    // Phase 2: AES decrypt from CDN
    return undefined;
  }

  // ── Events ──

  onMessage(handler: (msg: PlatformMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onCallback(handler: (event: CallbackEvent) => void): void {
    this.callbackHandlers.push(handler);
  }
}
