// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat event → platform-agnostic PlatformMessage mapping.
 */

import type { PlatformMessage } from "../types.js";
import type { WeChatMessage } from "./types.js";

/**
 * Convert a WeChat message to PlatformMessage.
 */
export function toMessage(msg: WeChatMessage): PlatformMessage | null {
  const userId = msg.from_user_id;
  if (!userId) return null;

  // Extract text from item_list
  let text: string | undefined;
  for (const item of msg.item_list ?? []) {
    if (item.type === 1 && item.text_item?.text) {
      text = item.text_item.text;
      break;
    }
  }

  // Use from_user_id as chatId (WeChat DM model)
  return {
    id: `${Date.now()}`,
    chatId: userId,
    userId,
    text,
    raw: msg,
  };
}

/**
 * Extract #ProjectName tag from message text.
 * Returns the tag (lowercase) and the remaining clean text.
 */
export function extractTag(text: string): {
  tag: string | null;
  cleanText: string;
} {
  const match = text.match(/^#(\S+)\s*([\s\S]*)/);
  if (match) {
    return { tag: match[1].toLowerCase(), cleanText: match[2].trim() };
  }
  return { tag: null, cleanText: text };
}
