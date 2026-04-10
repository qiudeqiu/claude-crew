// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Feishu event → platform-agnostic PlatformMessage / CallbackEvent mapping.
 */

import type { PlatformMessage, CallbackEvent } from "../types.js";
import type { FeishuMessageEvent, FeishuCardAction } from "./types.js";

/**
 * Convert an im.message.receive_v1 event to PlatformMessage.
 */
export function toMessage(event: FeishuMessageEvent): PlatformMessage | null {
  const msg = event.message;
  const sender = event.sender;
  if (!msg?.chat_id || !sender?.sender_id?.open_id) return null;

  // Parse text content from JSON wrapper
  let text: string | undefined;
  if (msg.content && msg.message_type === "text") {
    try {
      text = (JSON.parse(msg.content) as { text?: string }).text;
    } catch {
      text = msg.content;
    }
  }

  // Parse image content
  let photoFileId: string | undefined;
  if (msg.message_type === "image" && msg.content) {
    try {
      photoFileId = (JSON.parse(msg.content) as { image_key?: string })
        .image_key;
    } catch {
      // ignore malformed content
    }
  }

  // Build mention entities (compatible with platform-agnostic format)
  const entities: PlatformMessage["entities"] = [];
  if (msg.mentions) {
    for (const m of msg.mentions) {
      if (m.key && m.name) {
        // Feishu mentions use @_user_N keys in the text
        const mentionText = m.key;
        const offset = text?.indexOf(mentionText) ?? -1;
        entities.push({
          type: m.mentioned_type === "bot" ? "mention" : "text_mention",
          offset: offset >= 0 ? offset : 0,
          length: mentionText.length,
        });
      }
    }
  }

  return {
    id: msg.message_id ?? "",
    chatId: msg.chat_id,
    userId: sender.sender_id.open_id,
    username: undefined, // Feishu doesn't include username in events
    firstName: undefined, // Would need a separate API call
    text,
    photoFileId,
    entities: entities.length > 0 ? entities : undefined,
    raw: event,
  };
}

/**
 * Check if the bot was @mentioned in a message event.
 */
export function isBotMentioned(event: FeishuMessageEvent): boolean {
  return (
    event.message?.mentions?.some((m) => m.mentioned_type === "bot") ?? false
  );
}

/**
 * Strip Feishu @mention keys from text (e.g. "@_user_1" → "").
 * Feishu uses placeholder keys in the text content that map to the mentions array.
 */
export function stripMentions(text: string, event: FeishuMessageEvent): string {
  if (!event.message?.mentions) return text;
  let result = text;
  for (const m of event.message.mentions) {
    if (m.key) {
      result = result.replace(m.key, "");
    }
  }
  return result.trim();
}

/**
 * Convert a card.action.trigger event to CallbackEvent.
 */
export function toCallback(event: FeishuCardAction): CallbackEvent | null {
  const action = event.action;
  const operator = event.operator;
  const ctx = event.context;
  if (!operator?.open_id || !action?.value) return null;

  // Extract callback data from value map (our cards use { data: "callback:string" })
  const data = action.value.data ?? JSON.stringify(action.value);

  return {
    id: `${ctx?.open_message_id ?? ""}:${Date.now()}`, // Feishu has no callback query ID
    chatId: ctx?.open_chat_id ?? "",
    userId: operator.open_id,
    messageId: ctx?.open_message_id ?? "",
    data,
  };
}
