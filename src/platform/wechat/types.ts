// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot API types.
 * API docs: https://github.com/hao-ji-xing/openclaw-weixin/blob/main/weixin-bot-api.md
 */

export const WECHAT_BASE_URL = "https://ilinkai.weixin.qq.com";

// ── Message types ──

export type WeChatMessageItem = {
  type: number; // 1=text, 2=image, 3=voice, 4=file, 5=video
  text_item?: { text: string };
  image_item?: { aes_key: string; url: string };
  file_item?: { aes_key: string; url: string; file_name: string };
};

export type WeChatMessage = {
  from_user_id: string; // xxx@im.wechat
  to_user_id: string; // xxx@im.bot
  message_type: number;
  message_state: number;
  context_token: string;
  item_list: WeChatMessageItem[];
  msg_id?: string;
  create_time?: number;
};

// ── API responses ──

export type GetUpdatesResponse = {
  ret: number;
  msgs?: WeChatMessage[];
  get_updates_buf: string; // cursor for next poll
  longpolling_timeout_ms?: number;
};

export type SendMessageRequest = {
  msg: {
    to_user_id: string;
    message_type: number; // 2 = bot reply
    message_state: number; // 2 = normal
    context_token: string;
    item_list: WeChatMessageItem[];
  };
};

export type SendMessageResponse = {
  ret: number;
  msg_id?: string;
};

export type GetUploadUrlResponse = {
  ret: number;
  url?: string;
  file_id?: string;
};

export type QRCodeResponse = {
  qrcode: string;
  qrcode_img_content: string; // base64 image
};

export type QRCodeStatusResponse = {
  status: string; // "confirmed" when scanned
  bot_token?: string;
  baseurl?: string;
};

// ── Protocol version ──
export const CHANNEL_VERSION = "2.1.8";

/** Encode version string to uint32: "2.1.8" → (2<<16)|(1<<8)|8 = 131336 */
function buildClientVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((p) => parseInt(p, 10));
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

/** base_info required in ALL request bodies */
export function buildBaseInfo() {
  return { channel_version: CHANNEL_VERSION };
}

// ── Auth headers ──

export function buildHeaders(botToken: string): Record<string, string> {
  const uin = btoa(String(crypto.getRandomValues(new Uint32Array(1))[0]));
  return {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": uin,
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": String(buildClientVersion(CHANNEL_VERSION)),
    Authorization: `Bearer ${botToken}`,
  };
}
