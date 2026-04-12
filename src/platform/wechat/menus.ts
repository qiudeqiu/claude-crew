// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat text-menu emulation — translates Button[][] to numbered text menus
 * and intercepts number replies as synthetic CallbackEvents.
 */

import type { Button, CallbackEvent } from "../types.js";

const MENU_TTL_MS = 300_000; // 5 minutes
const SEPARATOR = "\u2501".repeat(15);

type PendingMenu = {
  flat: Button[];
  createdAt: number;
};

/** One active menu per chatId */
const pendingMenus = new Map<string, PendingMenu>();

/**
 * Render buttons as numbered text menu.
 * Example output:
 *   Main Menu
 *   ━━━━━━━━━━━━━━━
 *   1. Bots   2. Config
 *   3. Users  4. Status
 *
 *   回复数字选择
 */
export function renderTextMenu(text: string, buttons: Button[][]): string {
  const flat: Button[] = [];
  for (const row of buttons) {
    for (const btn of row) flat.push(btn);
  }

  const lines = [text, SEPARATOR];
  for (let i = 0; i < flat.length; i++) {
    lines.push(`${i + 1}. ${flat[i].text}`);
  }
  lines.push("\n\u2139\ufe0f \u56de\u590d\u6570\u5b57\u9009\u62e9"); // ℹ️ 回复数字选择
  return lines.join("\n");
}

/**
 * Register a menu for a chat. Replaces any existing menu.
 */
export function registerMenu(
  chatId: string,
  buttons: Button[][],
): void {
  const flat: Button[] = [];
  for (const row of buttons) {
    for (const btn of row) flat.push(btn);
  }
  pendingMenus.set(chatId, { flat, createdAt: Date.now() });
}

/**
 * Check if text is a number matching a pending menu.
 * Returns a synthetic CallbackEvent if matched, null otherwise.
 * Consumes the menu on match (one-shot).
 */
export function matchMenuInput(
  chatId: string,
  userId: string,
  text: string,
): CallbackEvent | null {
  const num = parseInt(text.trim(), 10);
  if (isNaN(num) || num < 1 || num > 99) return null;

  const menu = pendingMenus.get(chatId);
  if (!menu) return null;

  // Check TTL
  if (Date.now() - menu.createdAt > MENU_TTL_MS) {
    pendingMenus.delete(chatId);
    return null;
  }

  const idx = num - 1;
  if (idx >= menu.flat.length) return null;

  const btn = menu.flat[idx];
  // Don't consume — user might want to navigate back and re-select
  return {
    id: `menu:${Date.now()}`,
    chatId,
    userId,
    messageId: "",
    data: btn.data,
  };
}

/** Remove expired menus. Call periodically. */
export function cleanupMenus(): void {
  const now = Date.now();
  for (const [key, menu] of pendingMenus) {
    if (now - menu.createdAt > MENU_TTL_MS) {
      pendingMenus.delete(key);
    }
  }
}
