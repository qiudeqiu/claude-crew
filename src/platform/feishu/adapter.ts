// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Feishu Platform Adapter — wraps @larksuiteoapi/node-sdk into the Platform interface.
 *
 * Uses WSClient (WebSocket long-connection) for event subscription.
 * Card JSON 1.0 for all interactive elements (buttons, selects).
 * SDK client.im.v1.message.* for message CRUD.
 */

import {
  Client,
  WSClient,
  EventDispatcher,
  LoggerLevel,
} from "@larksuiteoapi/node-sdk";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  Platform,
  PlatformMessage,
  CallbackEvent,
  Button,
  BotInfo,
  SentMessage,
  CardCapable,
} from "../types.js";
import { INBOX_DIR } from "../../config.js";
import type { FeishuMessageEvent, FeishuCardAction } from "./types.js";
import {
  toMessage,
  toCallback,
  isBotMentioned,
  stripMentions,
} from "./events.js";
import { buildCard, buildTextCard } from "./cards.js";

/** Health check interval — if no events received within this window, reconnect */
const HEALTH_CHECK_MS = 300_000; // 5 min
const HEALTH_PING_MS = 60_000; // check every 1 min

export class FeishuAdapter implements Platform, CardCapable {
  private client: Client;
  private wsClient!: WSClient;
  private eventDispatcher: EventDispatcher;
  private appId: string;
  private appSecret: string;
  private messageHandlers: Array<(msg: PlatformMessage) => void> = [];
  private callbackHandlers: Array<(event: CallbackEvent) => void> = [];
  private keepaliveTimer?: ReturnType<typeof setInterval>;
  private healthTimer?: ReturnType<typeof setInterval>;
  private lastEventAt = Date.now();
  private reconnecting = false;
  /** This bot's open_id — used for mention filtering in multi-bot groups */
  public botOpenId = "";
  /** During card callback: token + openId for delayed card update API */
  private _delayedUpdate: { token: string; openId: string } | null = null;

  /**
   * @param token Format: "cli_xxxx:app_secret"
   */
  constructor(token: string) {
    const sep = token.indexOf(":");
    this.appId = token.slice(0, sep);
    this.appSecret = token.slice(sep + 1);

    this.client = new Client({
      appId: this.appId,
      appSecret: this.appSecret,
      disableTokenCache: false,
    });

    this.eventDispatcher = new EventDispatcher({});
    this.createWSClient();
  }

  private createWSClient(): void {
    this.wsClient = new WSClient({
      appId: this.appId,
      appSecret: this.appSecret,
      loggerLevel: LoggerLevel.warn,
      // Explicit config to avoid PingInterval undefined SDK bug
      autoReconnect: true,
    });
  }

  // ── Lifecycle ──

  async start(onReady: (info: BotInfo) => void): Promise<void> {
    // Register message handler
    // Message handler — MUST return immediately to let WSClient send ACK.
    // If ACK is delayed, Feishu server drops subsequent events.
    const msgQueue: FeishuMessageEvent[] = [];
    const processMsgQueue = () => {
      while (msgQueue.length > 0) {
        const event = msgQueue.shift()!;
        if (event.sender?.sender_type === "app") continue;
        const msg = toMessage(event);
        if (!msg) continue;
        (
          msg as PlatformMessage & { _feishuEvent: FeishuMessageEvent }
        )._feishuEvent = event;
        for (const h of this.messageHandlers) {
          try {
            Promise.resolve(h(msg)).catch(() => {});
          } catch {
            /* swallow */
          }
        }
      }
    };

    this.eventDispatcher.register({
      "im.message.receive_v1": async (data: unknown) => {
        msgQueue.push(data as FeishuMessageEvent);
        setTimeout(processMsgQueue, 0);
      },
    });

    // Register card action handler
    // Fire-and-forget: process callback async, return toast immediately.
    // UI updates via new messages (sendButtons), not in-place card replacement.
    // Card callback: return toast immediately, then update card via delayed API.
    // Long-connection mode cannot update cards via callback return value.
    // Instead we use the card update API with the callback token.
    this.eventDispatcher.register({
      "card.action.trigger": async (data: unknown) => {
        const event = data as FeishuCardAction;
        this.lastEventAt = Date.now();
        const cb = toCallback(event);
        if (!cb) return undefined;

        // Store callback token + operator for delayed card update
        const raw = data as Record<string, unknown>;
        const cbToken = (raw.token ?? (raw as any).Token) as string | undefined;
        const operatorId = event.operator?.open_id;

        // Enable delayed update mode — editButtons/sendButtons will use the API
        if (cbToken && operatorId) {
          this._delayedUpdate = { token: cbToken, openId: operatorId };
        } else {
        }

        for (const h of this.callbackHandlers) {
          try {
            await Promise.resolve(h(cb));
          } catch {
            /* swallow */
          }
        }

        this._delayedUpdate = null;
        return undefined;
      },
    });

    // Track event activity for health check
    const trackEvent = () => {
      this.lastEventAt = Date.now();
    };

    // Wrap message queue push with tracking
    const origMsgPush = msgQueue.push.bind(msgQueue);
    msgQueue.push = (...args) => {
      trackEvent();
      return origMsgPush(...args);
    };

    // Start WebSocket connection
    await this.wsClient.start({ eventDispatcher: this.eventDispatcher });

    // Fetch bot's own open_id for mention filtering (direct HTTP — SDK path unreliable)
    try {
      const tokenResp = await fetch(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
          }),
        },
      );
      const tokenData = (await tokenResp.json()) as {
        tenant_access_token?: string;
      };
      if (tokenData.tenant_access_token) {
        const infoResp = await fetch(
          "https://open.feishu.cn/open-apis/bot/v3/info",
          {
            headers: {
              Authorization: `Bearer ${tokenData.tenant_access_token}`,
            },
          },
        );
        const infoData = (await infoResp.json()) as {
          bot?: { open_id?: string; app_name?: string };
        };
        this.botOpenId = infoData.bot?.open_id ?? "";
        const appName = infoData.bot?.app_name;
        onReady({ username: appName || this.appId });
      } else {
        onReady({ username: this.appId });
      }
    } catch {
      onReady({ username: this.appId });
    }

    // Keep the event loop alive
    this.keepaliveTimer = setInterval(() => {}, 30_000);

    // Health check: if no events for HEALTH_CHECK_MS, force reconnect
    this.healthTimer = setInterval(() => {
      const silent = Date.now() - this.lastEventAt;
      if (silent > HEALTH_CHECK_MS && !this.reconnecting) {
        console.error(
          `[feishu] no events for ${Math.round(silent / 1000)}s, reconnecting...`,
        );
        this.reconnect();
      }
    }, HEALTH_PING_MS);
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    try {
      // Close existing connection
      try {
        this.wsClient.close({ force: true });
      } catch {
        /* ignore */
      }
      // Wait before reconnecting (avoid Feishu rate limit)
      await new Promise((r) => setTimeout(r, 5_000));
      this.createWSClient();
      await this.wsClient.start({ eventDispatcher: this.eventDispatcher });
      this.lastEventAt = Date.now();
      console.error("[feishu] reconnected successfully");
    } catch (err) {
      console.error(`[feishu] reconnect failed: ${err}`);
    } finally {
      this.reconnecting = false;
    }
  }

  async stop(): Promise<void> {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
    try {
      this.wsClient.close({ force: true });
    } catch {
      /* ignore */
    }
  }

  // ── Messages ──

  /**
   * Update card via delayed update API (using callback token).
   * open_ids must be inside the card object, not top-level.
   */
  private async delayedCardUpdate(
    card: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this._delayedUpdate) return false;
    try {
      const tokenResp = await fetch(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
          }),
        },
      );
      const tenantToken = (
        (await tokenResp.json()) as { tenant_access_token?: string }
      ).tenant_access_token;
      if (!tenantToken) return false;

      const resp = await fetch(
        "https://open.feishu.cn/open-apis/interactive/v1/card/update",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tenantToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: this._delayedUpdate.token,
            card: { ...card, open_ids: [this._delayedUpdate.openId] },
          }),
        },
      );
      const result = (await resp.json()) as { code?: number; msg?: string };
      if (result.code !== 0) {
        console.error(
          `[feishu] delayed update failed: ${result.code} ${result.msg}`,
        );
      }
      return result.code === 0;
    } catch (e) {
      console.error(`[feishu] delayed update error: ${e}`);
      return false;
    }
  }

  async sendMessage(chatId: string, text: string): Promise<SentMessage> {
    const card = buildTextCard(text);
    if (this._delayedUpdate) {
      const ok = await this.delayedCardUpdate(card);
      if (ok) return { id: "delayed", chatId };
    }
    const resp = await this.client.im.v1.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        content: JSON.stringify(card),
        msg_type: "interactive",
      },
    });
    if (resp.code !== 0) {
      throw new Error(`Feishu send failed: ${resp.code} ${resp.msg}`);
    }
    return { id: resp.data?.message_id ?? "", chatId };
  }

  async editMessage(
    chatId: string,
    msgId: string,
    text: string,
  ): Promise<void> {
    const card = buildTextCard(text);
    await this.client.im.v1.message
      .patch({
        path: { message_id: msgId },
        data: { content: JSON.stringify(card) },
      })
      .catch(() => {});
  }

  async deleteMessage(chatId: string, msgId: string): Promise<void> {
    await this.client.im.v1.message
      .delete({ path: { message_id: msgId } })
      .catch(() => {});
  }

  // ── Buttons / Interactive ──

  async sendButtons(
    chatId: string,
    text: string,
    buttons: Button[][],
  ): Promise<SentMessage> {
    const card = buildCard(text, buttons);
    // During callback: use delayed update API for in-place replacement
    if (this._delayedUpdate) {
      const ok = await this.delayedCardUpdate(card);
      if (ok) return { id: "delayed", chatId };
    }
    return this.sendCard(chatId, card);
  }

  async editButtons(
    chatId: string,
    msgId: string,
    text: string,
    buttons: Button[][],
  ): Promise<void> {
    const card = buildCard(text, buttons);
    // During callback: use delayed update API for in-place replacement
    if (this._delayedUpdate) {
      await this.delayedCardUpdate(card);
      return;
    }
    await this.client.im.v1.message
      .patch({
        path: { message_id: msgId },
        data: { content: JSON.stringify(card) },
      })
      .catch(() => {});
  }

  async editButtonsOnly(
    chatId: string,
    msgId: string,
    buttons: Button[][],
  ): Promise<void> {
    const card = buildCard("", buttons);
    await this.client.im.v1.message
      .patch({
        path: { message_id: msgId },
        data: { content: JSON.stringify(card) },
      })
      .catch(() => {});
  }

  // ── CardCapable ──

  async sendCard(chatId: string, card: unknown): Promise<SentMessage> {
    const resp = await this.client.im.v1.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        content: JSON.stringify(card),
        msg_type: "interactive",
      },
    });
    if (resp.code !== 0) {
      throw new Error(`Feishu card send failed: ${resp.code} ${resp.msg}`);
    }
    return { id: resp.data?.message_id ?? "", chatId };
  }

  // ── Feedback ──

  async answerCallback(_callbackId: string, _text?: string): Promise<void> {
    // Feishu card callbacks return toast via EventDispatcher return value.
    // By the time this is called, the response is already sent.
    // No-op — callers update the card via editButtons instead.
  }

  async sendTyping(_chatId: string): Promise<void> {
    // Feishu has no typing indicator API.
  }

  async setReaction(
    chatId: string,
    msgId: string,
    emoji: string,
  ): Promise<void> {
    // Feishu reactions use emoji_type strings, not Unicode.
    // Map common Unicode emoji to Feishu types.
    const emojiType = EMOJI_MAP[emoji] ?? "THUMBSUP";
    await (
      this.client.im.v1.messageReaction as unknown as {
        create: (req: {
          path: { message_id: string };
          data: { reaction_type: { emoji_type: string } };
        }) => Promise<unknown>;
      }
    )
      .create({
        path: { message_id: msgId },
        data: { reaction_type: { emoji_type: emojiType } },
      })
      .catch(() => {});
  }

  async pinMessage(chatId: string, msgId: string): Promise<void> {
    await (
      this.client.im.v1.pin as unknown as {
        create: (req: { data: { message_id: string } }) => Promise<unknown>;
      }
    )
      .create({ data: { message_id: msgId } })
      .catch(() => {});
  }

  // ── Files ──

  async downloadFile(fileId: string): Promise<string | undefined> {
    // fileId is an image_key from Feishu message content
    try {
      mkdirSync(INBOX_DIR, { recursive: true });
      const resp = await (
        this.client.im.v1.messageResource as unknown as {
          get: (req: {
            path: { message_id: string; file_key: string };
            params: { type: string };
          }) => Promise<{ writeFile: (p: string) => Promise<void> }>;
        }
      ).get({
        path: { message_id: "", file_key: fileId },
        params: { type: "image" },
      });
      const path = join(INBOX_DIR, `${Date.now()}.png`);
      await resp.writeFile(path);
      return path;
    } catch {
      return undefined;
    }
  }

  // ── Mention detection ──

  /** Check if THIS specific bot was @mentioned (not just any bot). */
  isMentionedIn(msg: PlatformMessage): boolean {
    const event = (
      msg as PlatformMessage & { _feishuEvent?: FeishuMessageEvent }
    )._feishuEvent;
    if (!event?.message?.mentions) return false;
    // If we know our open_id, match exactly; otherwise fall back to any bot mention
    if (this.botOpenId) {
      return event.message.mentions.some(
        (m) => m.mentioned_type === "bot" && m.id?.open_id === this.botOpenId,
      );
    }
    return isBotMentioned(event);
  }

  /** Strip @mention placeholders from message text. */
  stripMentions(msg: PlatformMessage): string {
    const event = (
      msg as PlatformMessage & { _feishuEvent?: FeishuMessageEvent }
    )._feishuEvent;
    if (!event) return msg.text ?? "";
    return stripMentions(msg.text ?? "", event);
  }

  // ── Events ──

  onMessage(handler: (msg: PlatformMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onCallback(handler: (event: CallbackEvent) => void): void {
    this.callbackHandlers.push(handler);
  }
}

// ── Emoji mapping: Unicode → Feishu emoji_type ──
// Only a subset of emoji types are valid. Tested: OK, THUMBSUP, SMILE, +1 work.
// EYES, DONE, CROSSMARK, THUMBSDOWN, HEART, FIRE, ROCKET are INVALID (231001).
const EMOJI_MAP: Record<string, string> = {
  "\uD83D\uDC40": "OK", // 👀 → OK (EYES not supported)
  "\u2705": "OK", // ✅ → OK
  "\u274C": "THUMBSUP", // ❌ → fallback
  "\uD83D\uDC4D": "THUMBSUP", // 👍
  "\uD83D\uDC4E": "THUMBSUP", // 👎 → fallback
  "\uD83D\uDE80": "SMILE", // 🚀 → SMILE (ROCKET not supported)
  "\u2764\uFE0F": "SMILE", // ❤️ → SMILE (HEART not supported)
  "\uD83D\uDD25": "SMILE", // 🔥 → SMILE (FIRE not supported)
};
