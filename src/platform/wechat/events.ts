// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat event → PlatformMessage mapping + #tag parsing.
 */

import type { PlatformMessage } from "../types.js";
import type { WeChatMessage } from "./types.js";

/**
 * Convert a WeChat message to PlatformMessage.
 */
export function toMessage(msg: WeChatMessage): PlatformMessage | null {
  if (!msg.from_user_id || !msg.context_token) return null;

  // Extract text content
  let text: string | undefined;
  for (const item of msg.item_list ?? []) {
    if (item.type === 1 && item.text_item?.text) {
      text = item.text_item.text;
      break;
    }
  }

  // Extract image (type 2)
  let photoFileId: string | undefined;
  for (const item of msg.item_list ?? []) {
    if (item.type === 2 && item.image_item?.url) {
      photoFileId = item.image_item.url;
      break;
    }
  }

  return {
    id: msg.msg_id ?? String(msg.create_time ?? Date.now()),
    chatId: msg.from_user_id, // WeChat: chatId is the sender's user ID (DM model)
    userId: msg.from_user_id,
    text,
    photoFileId,
    raw: msg,
  };
}

/**
 * Parse #tag prefix from message text.
 * Returns the tag (project name) and remaining text.
 *
 * Examples:
 *   "#api fix bug" → { tag: "api", cleanText: "fix bug" }
 *   "hello" → { tag: null, cleanText: "hello" }
 *   "#web" → { tag: "web", cleanText: "" }
 */
export function parseTag(text: string): {
  tag: string | null;
  cleanText: string;
} {
  const match = text.match(/^#(\S+)\s*(.*)/s);
  if (match) {
    return { tag: match[1].toLowerCase(), cleanText: match[2].trim() };
  }
  return { tag: null, cleanText: text };
}
