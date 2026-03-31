import type { Platform, Button } from "../platform/types.js";
import type { Lang } from "./i18n.js";
import { common, menuMsg } from "./i18n.js";

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
): Promise<void> {
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
  } else {
    if (buttons) {
      await platform.sendButtons(chatId, text, buttons).catch(() => {});
    } else {
      await platform.sendMessage(chatId, text).catch(() => {});
    }
  }
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

/** Edit a message, optionally with buttons */
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

export function mainMenuKeyboard(lang: Lang = "en"): Row[] {
  const m = menuMsg(lang);
  return [
    [
      { text: m.btnBots, data: "m:bots" },
      { text: m.btnConfig, data: "m:config" },
      { text: m.btnUsers, data: "m:users" },
    ],
    [
      { text: m.btnStatus, data: "m:status" },
      { text: m.btnCron, data: "m:cron" },
      { text: m.btnRestart, data: "m:restart" },
    ],
    [{ text: m.btnLang, data: "m:lang" }],
  ];
}
