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

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { WECHAT_BASE_URL, buildHeaders, buildBaseInfo } from "./types.js";

/** Persist context_tokens to survive daemon restarts. */
function ctxTokenPath(): string {
  const dir =
    process.env.TELEGRAM_POOL_DIR ??
    join(process.env.HOME ?? "/tmp", ".claude", "channels", "telegram");
  return join(dir, "wechat-ctx-tokens.json");
}

/** Generate unique client_id per message (required for delivery). */
function generateClientId(): string {
  return `claude-crew:${Date.now()}-${randomBytes(4).toString("hex")}`;
}
import type { WeChatMessage, GetUploadUrlResponse } from "./types.js";
import { WeChatPoller } from "./poller.js";
import { toMessage, parseTag } from "./events.js";
import { encrypt, decrypt } from "./crypto.js";
import { INBOX_DIR } from "../../config.js";
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
    // Restore context_tokens from disk
    try {
      if (existsSync(ctxTokenPath())) {
        const data = JSON.parse(readFileSync(ctxTokenPath(), "utf8"));
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === "string") this.contextTokens.set(k, v);
        }
      }
    } catch {
      /* start fresh */
    }
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
    console.error(
      `[wechat] send to=${chatId} len=${text.length} hasToken=${this.contextTokens.has(chatId)}`,
    );
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
          from_user_id: "",
          to_user_id: chatId,
          client_id: generateClientId(),
          message_type: 2,
          message_state: 2,
          context_token: contextToken,
          item_list: [{ type: 1, text_item: { text } }],
        },
        base_info: buildBaseInfo(),
      }),
    });

    const data = (await resp.json()) as Record<string, unknown>;
    console.error(`[wechat] send resp: ${JSON.stringify(data).slice(0, 300)}`);
    return { id: (data.msg_id as string) ?? "", chatId };
  }

  /** Send a file (image or document) to a chat. */
  async sendFile(
    chatId: string,
    filePath: string,
    _caption?: string,
  ): Promise<void> {
    const contextToken = this.contextTokens.get(chatId);
    if (!contextToken) return;

    try {
      const { createHash } = await import("crypto");
      const buf = readFileSync(filePath);
      const rawsize = buf.length;
      const rawfilemd5 = createHash("md5").update(buf).digest("hex");
      const aesKeyBuf = randomBytes(16);
      const filekey = randomBytes(16).toString("hex");
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

      // AES-128-ECB encrypt (PKCS7 padding added by cipher)
      const { createCipheriv } = await import("crypto");
      const cipher = createCipheriv("aes-128-ecb", aesKeyBuf, null);
      const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
      const filesize = encrypted.length;

      // 1. Get upload params
      const uploadResp = await fetch(
        `${WECHAT_BASE_URL}/ilink/bot/getuploadurl`,
        {
          method: "POST",
          headers: buildHeaders(this.botToken),
          body: JSON.stringify({
            filekey,
            media_type: isImage ? 1 : 3, // 1=image, 3=file
            to_user_id: chatId,
            rawsize,
            rawfilemd5,
            filesize,
            no_need_thumb: true,
            aeskey: aesKeyBuf.toString("hex"),
            base_info: buildBaseInfo(),
          }),
        },
      );
      const uploadData = (await uploadResp.json()) as Record<string, unknown>;
      // API returns upload_full_url (complete CDN URL) or upload_param (needs assembly)
      const cdnUrl =
        (uploadData.upload_full_url as string) ??
        (uploadData.upload_param
          ? `https://novac2c.cdn.weixin.qq.com/c2c/upload?encrypted_query_param=${encodeURIComponent(uploadData.upload_param as string)}&filekey=${encodeURIComponent(filekey)}`
          : undefined);
      if (!cdnUrl) {
        console.error(
          `[wechat] getuploadurl failed: ${JSON.stringify(uploadData).slice(0, 200)}`,
        );
        return;
      }

      // 2. Upload encrypted file to CDN
      const cdnResp = await fetch(cdnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(encrypted),
      });
      const downloadParam = cdnResp.headers.get("x-encrypted-param");
      if (!downloadParam) {
        console.error(
          `[wechat] CDN upload missing x-encrypted-param, status=${cdnResp.status}`,
        );
        return;
      }

      // 3. Send message with media reference
      const itemType = isImage ? 2 : 4; // item type: 2=IMAGE, 4=FILE
      const item = isImage
        ? {
            type: itemType,
            image_item: {
              media: {
                encrypt_query_param: downloadParam,
                aes_key: Buffer.from(aesKeyBuf.toString("hex")).toString(
                  "base64",
                ),
                encrypt_type: 1,
              },
              mid_size: filesize,
            },
          }
        : {
            type: itemType,
            file_item: {
              media: {
                encrypt_query_param: downloadParam,
                aes_key: Buffer.from(aesKeyBuf.toString("hex")).toString(
                  "base64",
                ),
                encrypt_type: 1,
              },
              file_name: filePath.split("/").pop() ?? "file",
              file_size: rawsize,
            },
          };

      await fetch(`${WECHAT_BASE_URL}/ilink/bot/sendmessage`, {
        method: "POST",
        headers: buildHeaders(this.botToken),
        body: JSON.stringify({
          msg: {
            from_user_id: "",
            to_user_id: chatId,
            client_id: generateClientId(),
            message_type: 2, // always 2 = BOT
            message_state: 2,
            context_token: contextToken,
            item_list: [item],
          },
          base_info: buildBaseInfo(),
        }),
      });
    } catch (e) {
      console.error(`[wechat] sendFile error: ${e}`);
    }
  }

  /** Download a file from WeChat CDN (AES decrypted). */
  async downloadFile(url: string, aesKey: string): Promise<string | undefined> {
    try {
      mkdirSync(INBOX_DIR, { recursive: true });
      const resp = await fetch(url);
      if (!resp.ok) return undefined;
      const encrypted = Buffer.from(await resp.arrayBuffer());
      const decrypted = decrypt(encrypted, aesKey);
      const path = join(INBOX_DIR, `${Date.now()}.bin`);
      writeFileSync(path, decrypted);
      return path;
    } catch {
      return undefined;
    }
  }

  /** Send typing indicator. */
  async sendTyping(chatId: string): Promise<void> {
    const contextToken = this.contextTokens.get(chatId);
    if (!contextToken) return;

    await fetch(`${WECHAT_BASE_URL}/ilink/bot/sendtyping`, {
      method: "POST",
      headers: buildHeaders(this.botToken),
      body: JSON.stringify({
        context_token: contextToken,
        base_info: buildBaseInfo(),
      }),
    }).catch(() => {});
  }

  // ── Internal message routing ──

  private handleMessage(raw: WeChatMessage): void {
    // Store context_token for replies + persist to disk
    if (raw.context_token) {
      this.contextTokens.set(raw.from_user_id, raw.context_token);
      try {
        writeFileSync(
          ctxTokenPath(),
          JSON.stringify(Object.fromEntries(this.contextTokens)),
          { mode: 0o600 },
        );
      } catch {
        /* non-fatal */
      }
    }

    const platformMsg = toMessage(raw);
    if (!platformMsg || !platformMsg.text) return;

    const userId = platformMsg.userId;
    const text = platformMsg.text;

    // 1. Check if it's a number reply to a pending menu (any bot)
    for (const adapter of [this.masterAdapter, ...this.botAdapters.values()]) {
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

export class WeChatBotAdapter implements Platform, FileCapable {
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

  async deleteMessage(_chatId: string, _msgId: string): Promise<void> {
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

  async answerCallback(_callbackId: string, _text?: string): Promise<void> {
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

  async downloadFile(fileId: string): Promise<string | undefined> {
    // fileId contains "url|aes_key" from toMessage
    const sep = fileId.indexOf("|");
    if (sep < 0) return undefined;
    const url = fileId.slice(0, sep);
    const aesKey = fileId.slice(sep + 1);
    return this.router.downloadFile(url, aesKey);
  }

  async sendFile(
    chatId: string,
    path: string,
    caption?: string,
  ): Promise<void> {
    await this.router.sendFile(chatId, path, caption);
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
