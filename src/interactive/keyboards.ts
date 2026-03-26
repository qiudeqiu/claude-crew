import type { Api } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import type { Lang } from "./i18n.js";
import { common, menuMsg } from "./i18n.js";

type Row = InlineKeyboardButton[];

// ── Shared constants ──

export const SEPARATOR = "\u2501".repeat(15);

// ── Shared helpers ──

export async function sendOrEdit(
  api: Api,
  chatId: string,
  text: string,
  messageId?: number,
  opts?: { reply_markup?: { inline_keyboard: Row[] } },
): Promise<void> {
  if (messageId) {
    await api.editMessageText(chatId, messageId, text, opts).catch(() => {});
  } else {
    await api.sendMessage(chatId, text, opts).catch(() => {});
  }
}

export function chunkRows(buttons: InlineKeyboardButton[], perRow = 2): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(buttons.slice(i, i + perRow));
  }
  return rows;
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
      { text: `\u2705 ${yesLabel ?? c.confirm}`, callback_data: yesData },
      { text: `\u274c ${noLabel ?? c.cancel}`, callback_data: noData },
    ],
  ];
}

export function singleButton(label: string, data: string): Row[] {
  return [[{ text: label, callback_data: data }]];
}

export function restartRow(lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [
    [{ text: `\ud83d\udd04 ${c.restartNow}`, callback_data: "o:restart" }],
  ];
}

export function cancelButton(backData: string, lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\u274c ${c.cancel}`, callback_data: `x:${backData}` }]];
}

export function backButton(data: string, lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\u25c0\ufe0f ${c.back}`, callback_data: data }]];
}

export function menuButton(lang: Lang = "en"): Row[] {
  const c = common(lang);
  return [[{ text: `\u25c0\ufe0f ${c.menu}`, callback_data: "m:menu" }]];
}

export function mainMenuKeyboard(lang: Lang = "en"): Row[] {
  const m = menuMsg(lang);
  return [
    [
      { text: m.btnBots, callback_data: "m:bots" },
      { text: m.btnConfig, callback_data: "m:config" },
      { text: m.btnUsers, callback_data: "m:users" },
    ],
    [
      { text: m.btnStatus, callback_data: "m:status" },
      { text: m.btnCron, callback_data: "m:cron" },
      { text: m.btnRestart, callback_data: "m:restart" },
    ],
    [{ text: m.btnLang, callback_data: "m:lang" }],
  ];
}
