// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot Platform Adapter.
 *
 * Architecture: WeChatRouter (singleton) + WeChatBotAdapter (per virtual bot).
 * One real connection, multiple virtual project bots via #tag routing.
 *
 * - WeChatRouter: owns the poller, context tokens, routes messages by #tag
 * - WeChatBotAdapter: implements Platform per bot, delegates to router for sends
 */

import { WECHAT_BASE_URL, buildHeaders } from "./types.js";
import type { WeChatMessage } from "./types.js";
import { WeChatPoller } from "./poller.js";
import { toMessage, parseTag } from "./events.js";
import {
  formatMenu,
  matchNumberReply,
  cleanupStaleMenus,
  type PendingMenu,
} from "./menus.js";
import type {
  Platform,
  PlatformMessage,
  CallbackEvent,
  Button,
  BotInfo,
  SentMessage,
  FileCapable,
} from "../types.js";

// ══════════════════════════════════════
// ── WeChatRouter — singleton per WeChat connection ──
// ══════════════════════════════════════

export class WeChatRouter {
  private botToken: string;
  private poller: WeChatPoller;
  /** Latest context_token per chat (required for sending replies). */
  private contextTokens = new Map<string, string>();
  /** User's last-used project name (for untagged message routing). */
  private lastProject = new Map<string, string>();
  /** Registered bot adapters by project name. */
  private botAdapters = new Map<string, WeChatBotAdapter>();
  /** Master bot adapter (handles management commands). */
  private masterAdapter?: WeChatBotAdapter;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.poller = new WeChatPoller(botToken);
  }

  /** Register a bot adapter for routing. */
  registerBot(projectName: string, adapter: WeChatBotAdapter): void {
    this.botAdapters.set(projectName.toLowerCase(), adapter);
  }

  /** Register the master bot adapter. */
  registerMaster(adapter: WeChatBotAdapter): void {
    this.masterAdapter = adapter;
  }

  /** Start polling and route messages to bot adapters. */
  start(onReady: (info: BotInfo) => void): void {
    this.poller.start((msg) => this.handleMessage(msg));
    onReady({ username: "wechat-bot" });

    // Periodically clean up stale pending menus
    setInterval(() => {
      for (const adapter of this.botAdapters.values()) {
        adapter.cleanupMenus();
      }
      this.masterAdapter?.cleanupMenus();
    }, 60_000);
  }

  stop(): void {
    this.poller.stop();
  }

  /** Send a text message. */
  async send(chatId: string, text: string): Promise<SentMessage> {
    const contextToken = this.contextTokens.get(chatId);
    if (!contextToken) {
      console.error(`[wechat] no context_token for ${chatId}, cannot send`);
      return { id: "", chatId };
    }

    const resp = await fetch(`${WECHAT_BASE_URL}/ilink/bot/sendmessage`, {
      method: "POST",
      headers: buildHeaders(this.botToken),
      body: JSON.stringify({
        msg: {
          to_user_id: chatId,
          message_type: 2,
          message_state: 2,
          context_token: contextToken,
          item_list: [{ type: 1, text_item: { text } }],
        },
      }),
    });

    const data = (await resp.json()) as { ret: number; msg_id?: string };
    return { id: data.msg_id ?? "", chatId };
  }

  /** Send typing indicator. */
  async sendTyping(chatId: string): Promise<void> {
    const contextToken = this.contextTokens.get(chatId);
    if (!contextToken) return;

    await fetch(`${WECHAT_BASE_URL}/ilink/bot/sendtyping`, {
      method: "POST",
      headers: buildHeaders(this.botToken),
      body: JSON.stringify({ context_token: contextToken }),
    }).catch(() => {});
  }

  // ── Internal message routing ──

  private handleMessage(raw: WeChatMessage): void {
    // Store context_token for replies
    if (raw.context_token) {
      this.contextTokens.set(raw.from_user_id, raw.context_token);
    }

    const platformMsg = toMessage(raw);
    if (!platformMsg || !platformMsg.text) return;

    const userId = platformMsg.userId;
    const text = platformMsg.text;

    // 1. Check if it's a number reply to a pending menu (any bot)
    for (const adapter of [
      this.masterAdapter,
      ...this.botAdapters.values(),
    ]) {
      if (adapter?.handleNumberReply(platformMsg)) return;
    }

    // 2. Parse #tag
    const { tag, cleanText } = parseTag(text);

    // 3. Master commands (no tag, keyword match)
    const masterKeywords =
      /^(menu|help|start|bots|config|users|setup|status|restart|search\s|cron\s)/i;
    if (!tag && masterKeywords.test(cleanText) && this.masterAdapter) {
      const masterMsg = { ...platformMsg, text: cleanText };
      this.masterAdapter.dispatchMessage(masterMsg);
      return;
    }

    // 4. Route by tag
    if (tag) {
      const adapter = this.botAdapters.get(tag);
      if (adapter) {
        this.lastProject.set(userId, tag);
        const taggedMsg = { ...platformMsg, text: cleanText || text };
        adapter.dispatchMessage(taggedMsg);
        return;
      }
      // Unknown tag — send help
      this.send(
        platformMsg.chatId,
        `未知项目 #${tag}\n\n已注册项目: ${[...this.botAdapters.keys()].map((k) => `#${k}`).join(", ") || "(无)"}`,
      ).catch(() => {});
      return;
    }

    // 5. No tag — route to last-used project
    const lastProj = this.lastProject.get(userId);
    if (lastProj) {
      const adapter = this.botAdapters.get(lastProj);
      if (adapter) {
        adapter.dispatchMessage(platformMsg);
        return;
      }
    }

    // 6. No last project — route to master
    if (this.masterAdapter) {
      this.masterAdapter.dispatchMessage(platformMsg);
    }
  }
}

// ══════════════════════════════════════
// ── WeChatBotAdapter — per-bot Platform implementation ──
// ══════════════════════════════════════

export class WeChatBotAdapter implements Platform {
  private router: WeChatRouter;
  private messageHandlers: Array<(msg: PlatformMessage) => void> = [];
  private callbackHandlers: Array<(event: CallbackEvent) => void> = [];
  /** Pending number menus per user. Key: userId */
  private pendingMenus = new Map<string, PendingMenu>();
  private lang: "en" | "zh";

  constructor(router: WeChatRouter, lang: "en" | "zh" = "zh") {
    this.router = router;
    this.lang = lang;
  }

  // ── Lifecycle ──

  async start(onReady: (info: BotInfo) => void): Promise<void> {
    // Router handles start — individual adapters don't start connections
    onReady({ username: "wechat-virtual" });
  }

  async stop(): Promise<void> {
    // Router handles stop
  }

  // ── Messages ──

  async sendMessage(chatId: string, text: string): Promise<SentMessage> {
    return this.router.send(chatId, text);
  }

  async editMessage(
    _chatId: string,
    _msgId: string,
    _text: string,
  ): Promise<void> {
    // WeChat doesn't support editing — no-op
    // Callers will send new messages via sendOrEdit fallback
  }

  async deleteMessage(
    _chatId: string,
    _msgId: string,
  ): Promise<void> {
    // WeChat iLink has no delete API
  }

  // ── Buttons / Interactive ──

  async sendButtons(
    chatId: string,
    text: string,
    buttons: Button[][],
  ): Promise<SentMessage> {
    const { formatted, flatButtons } = formatMenu(text, buttons, this.lang);
    // Store pending menu for the chat (will match on any user reply)
    this.pendingMenus.set(chatId, {
      buttons: flatButtons,
      createdAt: Date.now(),
    });
    return this.router.send(chatId, formatted);
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
    await this.sendButtons(chatId, "", buttons);
  }

  // ── Feedback ──

  async answerCallback(
    _callbackId: string,
    _text?: string,
  ): Promise<void> {
    // No-op — callbacks are synthesized from number replies
  }

  async sendTyping(chatId: string): Promise<void> {
    await this.router.sendTyping(chatId);
  }

  async setReaction(
    _chatId: string,
    _msgId: string,
    _emoji: string,
  ): Promise<void> {
    // WeChat iLink has no reaction API
  }

  async pinMessage(_chatId: string, _msgId: string): Promise<void> {
    // Not supported
  }

  // ── Files ──

  async downloadFile(_fileId: string): Promise<string | undefined> {
    // TODO Phase 3: AES decrypt + download from CDN
    return undefined;
  }

  // ── Events ──

  onMessage(handler: (msg: PlatformMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onCallback(handler: (event: CallbackEvent) => void): void {
    this.callbackHandlers.push(handler);
  }

  // ── Internal: called by WeChatRouter ──

  /** Dispatch a routed message to registered handlers. */
  dispatchMessage(msg: PlatformMessage): void {
    for (const h of this.messageHandlers) h(msg);
  }

  /**
   * Check if a message is a number reply to a pending menu.
   * If so, synthesize a CallbackEvent and fire callback handlers.
   * Returns true if handled.
   */
  handleNumberReply(msg: PlatformMessage): boolean {
    if (!msg.text) return false;
    const menu = this.pendingMenus.get(msg.chatId);
    if (!menu) return false;

    const matched = matchNumberReply(msg.text, menu);
    if (!matched) return false;

    // Remove the pending menu
    this.pendingMenus.delete(msg.chatId);

    // Synthesize CallbackEvent
    const event: CallbackEvent = {
      id: `wechat:${Date.now()}`,
      chatId: msg.chatId,
      userId: msg.userId,
      messageId: msg.id,
      data: matched.data,
    };

    for (const h of this.callbackHandlers) h(event);
    return true;
  }

  /** Clean up expired pending menus. */
  cleanupMenus(): void {
    cleanupStaleMenus(this.pendingMenus);
  }
}
