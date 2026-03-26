import type { ConversationState, ConversationStep } from "../types.js";
import { CONVERSATION_TTL_MS } from "../config.js";

const conversations = new Map<string, ConversationState>();

function key(userId: string, chatId: string): string {
  return `${userId}:${chatId}`;
}

export function getConversation(
  userId: string,
  chatId: string,
): ConversationState | undefined {
  const state = conversations.get(key(userId, chatId));
  if (!state) return undefined;
  if (state.expiresAt < Date.now()) {
    conversations.delete(key(userId, chatId));
    return undefined;
  }
  return state;
}

export function setConversation(
  userId: string,
  chatId: string,
  step: ConversationStep,
  data: Record<string, string> = {},
): void {
  const k = key(userId, chatId);
  const existing = conversations.get(k);
  conversations.set(k, {
    step,
    chatId,
    userId,
    data: existing ? { ...existing.data, ...data } : data,
    expiresAt: Date.now() + CONVERSATION_TTL_MS,
  });
}

export function clearConversation(userId: string, chatId: string): void {
  conversations.delete(key(userId, chatId));
}

export function cleanupExpired(): void {
  const now = Date.now();
  for (const [k, v] of conversations) {
    if (v.expiresAt < now) conversations.delete(k);
  }
}
