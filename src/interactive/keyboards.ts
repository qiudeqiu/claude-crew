// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { Platform, Button } from "../platform/types.js";
import type { Lang } from "./i18n.js";
import type { AdminPermission } from "../types.js";
import { common, menuMsg } from "./i18n.js";
import { hasPermission, getPlatform, loadPool } from "../config.js";

type Row = Button[];

// ── Shared constants ──

export const SEPARATOR = "\u2501".repeat(15);

// ── Shared helpers ──

export async function sendOrEdit(
  platform: Platform,
  chatId: string,
  text: string,
  messageId?: number | string,
  opts?: { reply_markup?: { inline_keyboard: Row[] } },
): Promise<string | undefined> {
  const buttons = opts?.reply_markup?.inline_keyboard;
  if (messageId) {
    if (buttons) {
      await platform
        .editButtons(chatId, String(messageId), text, buttons)
        .catch(() => {});
    } else {
      await platform
        .editMessage(chatId, String(messageId), text)
        .catch(() => {});
    }
    return String(messageId);
  }
  if (buttons) {
    const sent = await platform
      .sendButtons(chatId, text, buttons)
      .catch(() => null);
    return sent?.id;
  }
  const sent = await platform.sendMessage(chatId, text).catch(() => null);
  return sent?.id;
}

export function chunkRows(buttons: Button[], perRow = 2): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(buttons.slice(i, i + perRow));
  }
  return rows;
}

/** Send a message, optionally with buttons */
export async function send(
  platform: Platform,
  chatId: string,
  text: string,
  opts?: { reply_markup?: { inline_keyboard: Row[] } },
): Promise<void> {
  const buttons = opts?.reply_markup?.inline_keyboard;
  if (buttons) {
    await platform.sendButtons(chatId, text, buttons).catch(() => {});
  } else {
    await platform.sendMessage(chatId, text).catch(() => {});
  }
}

/** Edit a message, optionally with buttons. */
export async function edit(
  platform: Platform,
  chatId: string,
  messageId: number | string,
  text: string,
  opts?: { reply_markup?: { inline_keyboard: Row[] } },
): Promise<void> {
  const buttons = opts?.reply_markup?.inline_keyboard;
  if (buttons) {
    await platform
      .editButtons(chatId, String(messageId), text, buttons)
      .catch(() => {});
  } else {
    await platform.editMessage(chatId, String(messageId), text).catch(() => {});
  }
}

// ── Keyboard builders ──

export function confirmRow(
  yesData: string,
  noData: string,
  yesLabel?: string,
  noLabel?: string,
  lang: Lang = "en",
): Row[] {
  const c = common(lang);
  return [
    [
      { text: `\u2705 ${yesLabel ?? c.confirm}`, data: yesData },
      { text: `\u274c ${noLabel ?? c.cancel}`, data: noData },
    ],
  ];
}

export function singleButton(label: string, data: string): Row[] {
  return [[{ text: label, data }]];
}

export function restartRow(lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\ud83d\udd04 ${c.restartNow}`, data: "o:restart" }]];
}

export function cancelButton(backData: string, lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\u274c ${c.cancel}`, data: `x:${backData}` }]];
}

export function backButton(data: string, lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\u25c0\ufe0f ${c.back}`, data }]];
}

export function menuButton(lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\u25c0\ufe0f ${c.menu}`, data: "m:menu" }]];
}

export function mainMenuKeyboard(lang: Lang = "en", userId?: string): Row[] {
  const m = menuMsg(lang);

  // Permission-gated buttons
  const gated: Array<{ btn: Button; perm: AdminPermission }> = [
    { btn: { text: m.btnBots, data: "m:bots" }, perm: "bots" },
    { btn: { text: m.btnConfig, data: "m:config" }, perm: "config" },
    { btn: { text: m.btnUsers, data: "m:users" }, perm: "users" },
  ];
  const gated2: Array<{ btn: Button; perm: AdminPermission }> = [
    { btn: { text: m.btnCron, data: "m:cron" }, perm: "cron" },
    { btn: { text: m.btnRestart, data: "m:restart" }, perm: "restart" },
  ];

  const platform = getPlatform();

  const filterRow = (items: typeof gated): Button[] =>
    items
      .filter((g) => !userId || hasPermission(userId, g.perm))
      // WeChat: hide "users" button (no per-bot allowedUsers support)
      .filter((g) => !(platform === "wechat" && g.perm === "users"))
      .map((g) => g.btn);

  const row1 = filterRow(gated);
  const row2 = [{ text: m.btnStatus, data: "m:status" }, ...filterRow(gated2)];
  const row3: Button[] = [{ text: m.btnLang, data: "m:lang" }];
  // WeChat only: docs capability before help
  if (platform === "wechat") {
    row3.push({ text: "\ud83d\udcc4 文档能力", data: "m:wecom" });
  }
  row3.push({ text: m.btnHelp, data: "m:help" });

  const rows: Row[] = [];
  if (row1.length > 0) rows.push(row1);
  if (row2.length > 0) rows.push(row2);
  // Telegram/Feishu only: push toggle on its own row to avoid truncation
  if (platform !== "wechat" && platform !== "discord") {
    const pushEnabled = loadPool().pushAuthEnabled ?? false;
    rows.push([{ text: pushEnabled ? m.btnPushAuthOn : m.btnPushAuthOff, data: "m:pushauth" }]);
  }
  rows.push(row3);
  return rows;
}
