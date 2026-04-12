// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot API client — low-level HTTP calls.
 */

import type { WeChatPollResponse } from "./types.js";

const BASE_URL = "https://ilinkai.weixin.qq.com";

export class WeChatApi {
  private token: string;
  private uin: string;

  constructor(token: string) {
    this.token = token;
    // X-WECHAT-UIN: base64(String(randomUint32)) — replay protection
    const rand = Math.floor(Math.random() * 0xffffffff);
    this.uin = btoa(String(rand));
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      AuthorizationType: "ilink_bot_token",
      "X-WECHAT-UIN": this.uin,
      Authorization: `Bearer ${this.token}`,
    };
  }

  /** Long-poll for new messages. Holds connection up to 35s. */
  async poll(cursor?: string): Promise<WeChatPollResponse> {
    const resp = await fetch(`${BASE_URL}/ilink/bot/getupdates`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        get_updates_buf: cursor ?? "",
        base_info: { channel_version: "1.0.2" },
      }),
    });
    return (await resp.json()) as WeChatPollResponse;
  }

  /** Send a text message. context_token is required for threading. */
  async send(
    toUserId: string,
    text: string,
    contextToken: string,
  ): Promise<void> {
    await fetch(`${BASE_URL}/ilink/bot/sendmessage`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        msg: {
          to_user_id: toUserId,
          message_type: 2,
          message_state: 2,
          context_token: contextToken,
          item_list: [{ type: 1, text_item: { text } }],
        },
      }),
    });
  }

  /** Send typing indicator. */
  async sendTyping(contextToken: string): Promise<void> {
    try {
      await fetch(`${BASE_URL}/ilink/bot/sendtyping`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ context_token: contextToken }),
      });
    } catch {
      // best-effort
    }
  }
}
