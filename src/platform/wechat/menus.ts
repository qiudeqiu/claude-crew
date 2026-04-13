// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat number-menu system.
 * Converts platform-agnostic Button[][] to numbered text menus,
 * and parses number replies back to CallbackEvents.
 */

import type { Button } from "../types.js";

/** A pending menu waiting for a number reply. */
export type PendingMenu = {
  /** Flattened list of buttons in display order. */
  buttons: Button[];
  /** When the menu was sent. */
  createdAt: number;
};

/** Max age for pending menus — 5 minutes. */
const MENU_MAX_AGE_MS = 300_000;

/**
 * Convert Button[][] to a numbered text menu string.
 *
 * Example output:
 * ```
 * 菜单标题
 * ━━━━━━━━
 * 1. 机器人
 * 2. 配置
 * 3. 用户
 *
 * 回复数字选择
 * ```
 */
export function formatMenu(
  text: string,
  buttons: Button[][],
  lang: "en" | "zh" = "zh",
): { formatted: string; flatButtons: Button[] } {
  const flat: Button[] = [];
  const lines: string[] = [];

  if (text) lines.push(text, "");

  let n = 1;
  for (const row of buttons) {
    for (const btn of row) {
      flat.push(btn);
      lines.push(`${n}. ${btn.text}`);
      n++;
    }
  }

  lines.push("");
  lines.push(
    lang === "zh"
      ? "回复数字选择（5 分钟内有效）"
      : "Reply with a number (valid for 5 min)",
  );

  return { formatted: lines.join("\n"), flatButtons: flat };
}

/**
 * Try to match a user reply as a number selection for a pending menu.
 * Returns the matching Button or null.
 */
export function matchNumberReply(
  text: string,
  menu: PendingMenu,
): Button | null {
  const trimmed = text.trim();
  // Accept: "1", "1.", "1、", "01"
  const match = trimmed.match(/^(\d+)[.、]?$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  if (num < 1 || num > menu.buttons.length) return null;

  return menu.buttons[num - 1];
}

/**
 * Remove stale pending menus older than maxAge.
 */
export function cleanupStaleMenus(
  menus: Map<string, PendingMenu>,
  maxAgeMs = MENU_MAX_AGE_MS,
): void {
  const now = Date.now();
  for (const [key, menu] of menus) {
    if (now - menu.createdAt > maxAgeMs) {
      menus.delete(key);
    }
  }
}
