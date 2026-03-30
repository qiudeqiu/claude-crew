import type { Api } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import type { ManagedBot } from "../types.js";
import { loadPool, savePool } from "../config.js";
import { log } from "../logger.js";
import {
  getConversation,
  setConversation,
  clearConversation,
} from "./state.js";
import { validatePath } from "./validate.js";
import {
  cancelButton,
  menuButton,
  sendOrEdit,
  SEPARATOR,
} from "./keyboards.js";
import {
  getLang,
  configMsg,
  fieldDesc,
  optDesc,
  fieldHint,
  common,
} from "./i18n.js";

// ── Field definitions ──

type FieldDef = {
  key: string;
  descKey: string;
  options?: string[];
  optionDescKeys?: string[];
  type?: "number" | "string";
  min?: number;
  max?: number;
  restart?: boolean;
  hintKey?: string;
};

const GLOBAL_FIELDS: Record<string, FieldDef> = {
  pm: {
    key: "permissionMode",
    descKey: "pm",
    options: ["allowAll", "approve", "auto"],
    optionDescKeys: ["pm_allowAll", "pm_approve", "pm_auto"],
  },
  al: {
    key: "accessLevel",
    descKey: "al",
    options: ["readWrite", "readOnly"],
    optionDescKeys: ["al_readWrite", "al_readOnly"],
  },
  me: {
    key: "masterExecute",
    descKey: "me",
    options: ["true", "false"],
    optionDescKeys: ["me_true", "me_false"],
  },
  mc: {
    key: "maxConcurrent",
    descKey: "mc",
    type: "number",
    min: 1,
    max: 10,
    hintKey: "mc",
  },
  rl: {
    key: "rateLimitSeconds",
    descKey: "rl",
    type: "number",
    min: 0,
    max: 60,
    hintKey: "rl",
  },
  st: {
    key: "sessionTimeoutMinutes",
    descKey: "st",
    type: "number",
    min: 1,
    max: 120,
    hintKey: "st",
  },
  di: {
    key: "dashboardIntervalMinutes",
    descKey: "di",
    type: "number",
    min: 5,
    max: 1440,
    restart: true,
    hintKey: "di",
  },
  mi: {
    key: "memoryIntervalMinutes",
    descKey: "mi",
    type: "number",
    min: 0,
    max: 1440,
    hintKey: "mi",
  },
  wl: { key: "whisperLanguage", descKey: "wl", type: "string", hintKey: "wl" },
  md: {
    key: "model",
    descKey: "md",
    options: ["sonnet", "opus", "haiku"],
    optionDescKeys: ["md_sonnet", "md_opus", "md_haiku"],
  },
  ap_list: {
    key: "approvers",
    descKey: "ap_list",
    type: "string",
    hintKey: "ap_list",
  },
};

const BOT_FIELDS: Record<string, FieldDef> = {
  pm: {
    key: "permissionMode",
    descKey: "pm",
    options: ["inherit", "allowAll", "approve", "auto"],
    optionDescKeys: ["pm_inherit", "pm_allowAll", "pm_approve", "pm_auto"],
  },
  al: {
    key: "accessLevel",
    descKey: "al",
    options: ["inherit", "readWrite", "readOnly"],
    optionDescKeys: ["al_inherit", "al_readWrite", "al_readOnly"],
  },
  ap: { key: "assignedProject", descKey: "ap", type: "string", hintKey: "ap" },
  ph: { key: "assignedPath", descKey: "ph", type: "string", hintKey: "ph" },
  md: {
    key: "model",
    descKey: "md",
    options: ["inherit", "sonnet", "opus", "haiku"],
    optionDescKeys: ["md_inherit", "md_sonnet", "md_opus", "md_haiku"],
  },
  ap_list: {
    key: "approvers",
    descKey: "ap_list",
    type: "string",
    hintKey: "ap_list",
  },
};

function getFieldLabel(key: string): string {
  // Field labels stay as-is (technical names)
  const labels: Record<string, string> = {
    permissionMode: "permissionMode",
    accessLevel: "accessLevel",
    masterExecute: "masterExecute",
    maxConcurrent: "maxConcurrent",
    rateLimitSeconds: "rateLimitSeconds",
    sessionTimeoutMinutes: "sessionTimeout",
    dashboardIntervalMinutes: "dashboardInterval",
    memoryIntervalMinutes: "memoryInterval",
    whisperLanguage: "whisperLanguage",
    assignedProject: "project",
    assignedPath: "path",
    approvers: "approvers",
  };
  return labels[key] ?? key;
}

// ── Global config view ──

export async function showGlobalConfig(
  managed: ManagedBot,
  chatId: string,
  messageId?: number,
): Promise<void> {
  const lang = getLang();
  const cm = configMsg(lang);
  const fd = fieldDesc(lang);
  const od = optDesc(lang);
  const api = managed.bot.api;
  const pool = loadPool();

  const pm = pool.permissionMode ?? "allowAll";
  const al = pool.accessLevel ?? "readWrite";
  const me = pool.masterExecute ?? false;

  const text =
    `${cm.globalTitle}\n${SEPARATOR}\u2501\u2501\u2501\u2501\u2501\n\n` +
    `\ud83d\udee1\ufe0f permissionMode: ${pm}\n   ${(od as Record<string, string>)[`pm_${pm}`]}\n\n` +
    `\ud83d\udd10 accessLevel: ${al}\n   ${(od as Record<string, string>)[`al_${al}`]}\n\n` +
    `\ud83e\udd16 masterExecute: ${me}\n   ${(od as Record<string, string>)[`me_${me}`]}\n\n` +
    `\ud83d\udd22 maxConcurrent: ${pool.maxConcurrent ?? 3}\n   ${fd.mc}\n\n` +
    `\u23f1\ufe0f rateLimitSeconds: ${pool.rateLimitSeconds ?? 5}\n   ${fd.rl}\n\n` +
    `\u23f0 sessionTimeout: ${pool.sessionTimeoutMinutes ?? 10} min\n   ${fd.st}\n\n` +
    `\ud83d\udcca dashboardInterval: ${pool.dashboardIntervalMinutes ?? 30} min \u26a1\n   ${fd.di}\n\n` +
    `\ud83e\udde0 memoryInterval: ${pool.memoryIntervalMinutes ?? 120} min\n   ${fd.mi}\n\n` +
    `\ud83c\udfa4 whisperLanguage: ${pool.whisperLanguage || "(auto)"}\n   ${fd.wl}\n\n` +
    `\ud83e\udd16 model: ${pool.model || "(default)"}\n   ${fd.md}\n\n` +
    `\ud83d\udd10 approvers: ${pool.approvers?.length ? pool.approvers.join(", ") : "(any admin)"}\n   ${fd.ap_list}`;

  const buttons: InlineKeyboardButton[][] = [
    [
      { text: "permissionMode", callback_data: "c:ge:pm" },
      { text: "accessLevel", callback_data: "c:ge:al" },
    ],
    [
      { text: "masterExecute", callback_data: "c:ge:me" },
      { text: "maxConcurrent", callback_data: "c:ge:mc" },
    ],
    [
      { text: "rateLimitSeconds", callback_data: "c:ge:rl" },
      { text: "sessionTimeout", callback_data: "c:ge:st" },
    ],
    [
      { text: "dashboardInterval \u26a1", callback_data: "c:ge:di" },
      { text: "memoryInterval", callback_data: "c:ge:mi" },
    ],
    [
      { text: "whisperLanguage", callback_data: "c:ge:wl" },
      { text: "model", callback_data: "c:ge:md" },
    ],
    [{ text: "approvers", callback_data: "c:ge:ap_list" }],
    ...menuButton(lang),
  ];

  const opts = { reply_markup: { inline_keyboard: buttons } };
  if (messageId) {
    await api.editMessageText(chatId, messageId, text, opts).catch(() => {});
  } else {
    await api.sendMessage(chatId, text, opts).catch(() => {});
  }
}

// ── Per-bot config view ──

export async function showBotConfig(
  api: Api,
  chatId: string,
  username: string,
  messageId?: number,
): Promise<void> {
  const lang = getLang();
  const cm = configMsg(lang);
  const fd = fieldDesc(lang);
  const c = common(lang);
  const pool = loadPool();
  const bot = pool.bots.find((b) => b.username === username);
  if (!bot) return;

  const globalPm = pool.permissionMode ?? "allowAll";
  const globalAl = pool.accessLevel ?? "readWrite";

  const pmDisplay =
    bot.permissionMode === globalPm
      ? `${bot.permissionMode} ${cm.matchesGlobal}`
      : `${bot.permissionMode ?? globalPm} ${cm.globalIs(globalPm)}`;
  const alDisplay =
    bot.accessLevel === globalAl
      ? `${bot.accessLevel} ${cm.matchesGlobal}`
      : `${bot.accessLevel ?? globalAl} ${cm.globalIs(globalAl)}`;

  const text =
    `${cm.botConfigTitle(username)}\n${SEPARATOR}\n\n` +
    `\ud83d\udee1\ufe0f permissionMode: ${pmDisplay}\n   ${fd.pm}\n\n` +
    `\ud83d\udd10 accessLevel: ${alDisplay}\n   ${fd.al}\n\n` +
    `\ud83d\udcc2 project: ${bot.assignedProject ?? "(none)"}\n   ${fd.ap}\n\n` +
    `\ud83d\udccd path: ${bot.assignedPath ?? "(none)"}\n   ${fd.ph}\n\n` +
    `\ud83d\udd10 approvers: ${bot.approvers?.length ? bot.approvers.join(", ") : "(inherit)"}\n   ${fd.ap_list}`;

  const buttons: InlineKeyboardButton[][] = [
    [
      { text: "permissionMode", callback_data: `c:be:${username}:pm` },
      { text: "accessLevel", callback_data: `c:be:${username}:al` },
    ],
    [
      { text: "project", callback_data: `c:be:${username}:ap` },
      { text: "path", callback_data: `c:be:${username}:ph` },
    ],
    [{ text: "model", callback_data: `c:be:${username}:md` }],
    [{ text: "approvers", callback_data: `c:be:${username}:ap_list` }],
    [{ text: `\u25c0\ufe0f ${c.back}`, callback_data: `b:d:${username}` }],
  ];

  const opts = { reply_markup: { inline_keyboard: buttons } };
  if (messageId) {
    await api.editMessageText(chatId, messageId, text, opts).catch(() => {});
  } else {
    await api.sendMessage(chatId, text, opts).catch(() => {});
  }
}

// ── Callback handler ──

export async function handleConfigCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number,
): Promise<boolean> {
  const api = managed.bot.api;

  if (data === "c:g") {
    await showGlobalConfig(managed, chatId, messageId);
    return true;
  }

  if (data.startsWith("c:b:")) {
    const username = data.slice(4);
    await showBotConfig(api, chatId, username, messageId);
    return true;
  }

  if (data.startsWith("c:ge:")) {
    const fieldKey = data.slice(5);
    const field = GLOBAL_FIELDS[fieldKey];
    if (!field) return false;
    return await showFieldEditor(
      api,
      chatId,
      userId,
      field,
      fieldKey,
      "global",
      messageId,
    );
  }

  if (data.startsWith("c:gv:")) {
    const parts = data.slice(5).split(":");
    const [fieldKey, ...valueParts] = parts;
    const value = valueParts.join(":");
    const field = GLOBAL_FIELDS[fieldKey!];
    if (!field) return false;
    return await setGlobalValue(api, chatId, userId, field, value, messageId);
  }

  if (data.startsWith("c:be:")) {
    const rest = data.slice(5);
    const lastColon = rest.lastIndexOf(":");
    const username = rest.slice(0, lastColon);
    const fieldKey = rest.slice(lastColon + 1);
    const field = BOT_FIELDS[fieldKey];
    if (!field) return false;
    return await showFieldEditor(
      api,
      chatId,
      userId,
      field,
      fieldKey,
      username,
      messageId,
    );
  }

  if (data.startsWith("c:bv:")) {
    const rest = data.slice(5);
    const parts = rest.split(":");
    if (parts.length < 3) return false;
    const fieldKey = parts[parts.length - 2]!;
    const value = parts[parts.length - 1]!;
    const username = parts.slice(0, -2).join(":");
    const field = BOT_FIELDS[fieldKey];
    if (!field) return false;
    return await setBotValue(
      api,
      chatId,
      userId,
      username,
      field,
      value,
      messageId,
    );
  }

  return false;
}

// ── Show field editor ──

async function showFieldEditor(
  api: Api,
  chatId: string,
  userId: string,
  field: FieldDef,
  fieldKey: string,
  scope: string,
  messageId: number,
): Promise<boolean> {
  const lang = getLang();
  const cm = configMsg(lang);
  const fd = fieldDesc(lang);
  const od = optDesc(lang);
  const fh = fieldHint(lang);
  const pool = loadPool();
  const isGlobal = scope === "global";
  const label = getFieldLabel(field.key);

  const source = isGlobal ? pool : pool.bots.find((b) => b.username === scope);
  const currentValue = String(
    (source as unknown as Record<string, unknown>)?.[field.key] ?? "(not set)",
  );

  const desc = (fd as Record<string, string>)[field.descKey] ?? "";

  if (field.options) {
    const restartNote = field.restart ? `\n${cm.requiresRestart}` : "";

    const optLines = field.options
      .map((opt, i) => {
        const marker = opt === currentValue ? "\u2705 " : "\u25cb ";
        const descKey = field.optionDescKeys?.[i];
        const optDescText = descKey
          ? ((od as Record<string, string>)[descKey] ?? "")
          : "";
        return `${marker}${opt}\n   ${optDescText}`;
      })
      .join("\n");

    const buttons: InlineKeyboardButton[][] = [];
    const row: InlineKeyboardButton[] = [];
    for (const opt of field.options) {
      const marker = opt === currentValue ? "\u2705 " : "";
      const cbData = isGlobal
        ? `c:gv:${fieldKey}:${opt}`
        : `c:bv:${scope}:${fieldKey}:${opt}`;
      row.push({ text: `${marker}${opt}`, callback_data: cbData });
      if (row.length === 2) {
        buttons.push([...row]);
        row.length = 0;
      }
    }
    if (row.length > 0) buttons.push([...row]);

    const backData = isGlobal ? "c:g" : `c:b:${scope}`;
    buttons.push([
      { text: `\u25c0\ufe0f ${common(lang).back}`, callback_data: backData },
    ]);

    await api
      .editMessageText(
        chatId,
        messageId,
        `${cm.editTitle(label)}\n${desc}${restartNote}\n\n${cm.current}: ${currentValue}\n\n${optLines}`,
        { reply_markup: { inline_keyboard: buttons } },
      )
      .catch(() => {});
    return true;
  }

  // Number/string: text input
  const rangeHint =
    field.type === "number"
      ? `\n${cm.range(field.min!, field.max!)}`
      : `\n${cm.clearHint}`;
  const tipHint = field.hintKey
    ? `\n${cm.tip}: ${(fh as Record<string, string>)[field.hintKey]}`
    : "";
  const restartNote = field.restart ? `\n${cm.requiresRestart}` : "";
  const backData = isGlobal ? "c:g" : `c:b:${scope}`;

  await api
    .editMessageText(
      chatId,
      messageId,
      `${cm.editTitle(label)}\n${desc}\n\n${cm.current}: ${currentValue}${rangeHint}${tipHint}${restartNote}\n\n${cm.sendValue}`,
      { reply_markup: { inline_keyboard: cancelButton(backData, lang) } },
    )
    .catch(() => {});

  setConversation(userId, chatId, "config:awaitValue", {
    editField: fieldKey,
    editScope: scope,
  });
  return true;
}

// ── Set global value ──

async function setGlobalValue(
  api: Api,
  chatId: string,
  userId: string,
  field: FieldDef,
  value: string,
  messageId: number,
): Promise<boolean> {
  const lang = getLang();
  const cm = configMsg(lang);
  const label = getFieldLabel(field.key);
  const pool = loadPool();

  let parsedValue: unknown = value;
  if (field.key === "masterExecute") parsedValue = value === "true";
  if (field.key === "approvers") {
    parsedValue = value
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  savePool({ ...pool, [field.key]: parsedValue });
  log(`CONFIG: global.${field.key} = ${value} by ${userId}`);

  const projectBots = pool.bots.filter((b) => b.role !== "master");
  let impact = "";
  if (field.key === "permissionMode" || field.key === "accessLevel") {
    const matching = projectBots.filter(
      (b) => (b as unknown as Record<string, unknown>)[field.key] === value,
    ).length;
    const different = projectBots.length - matching;
    if (projectBots.length > 0) {
      impact = `\n${cm.impact(matching, different)}`;
    }
  }

  const restartNote = field.restart ? `\n${cm.restartNeeded}` : "";

  await api
    .editMessageText(
      chatId,
      messageId,
      `${cm.saved(label, value)}${impact}${restartNote}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `\u25c0\ufe0f ${cm.backConfig}`, callback_data: "c:g" }],
          ],
        },
      },
    )
    .catch(() => {});
  return true;
}

// ── Set bot value ──

async function setBotValue(
  api: Api,
  chatId: string,
  userId: string,
  username: string,
  field: FieldDef,
  value: string,
  messageId: number,
): Promise<boolean> {
  const lang = getLang();
  const cm = configMsg(lang);
  const label = getFieldLabel(field.key);
  const pool = loadPool();
  const bot = pool.bots.find((b) => b.username === username);
  if (!bot) return false;

  const updatedBots = pool.bots.map((b) => {
    if (b.username !== username) return b;
    if (value === "inherit") {
      const { [field.key]: _, ...rest } = b as unknown as Record<
        string,
        unknown
      >;
      return rest;
    }
    return { ...b, [field.key]: value };
  });
  savePool({ ...pool, bots: updatedBots as typeof pool.bots });
  log(`CONFIG: @${username}.${field.key} = ${value} by ${userId}`);

  await api
    .editMessageText(
      chatId,
      messageId,
      `${cm.saved(`@${username} ${label}`, value)}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `\u25c0\ufe0f ${cm.backBotConfig}`,
                callback_data: `c:b:${username}`,
              },
            ],
          ],
        },
      },
    )
    .catch(() => {});
  return true;
}

// ── Text input handler ──

export async function handleConfigText(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const state = getConversation(userId, chatId);
  if (!state || state.step !== "config:awaitValue") return false;

  const api = managed.bot.api;
  const { editField, editScope } = state.data;
  if (!editField || !editScope) return false;

  const lang = getLang();
  const cm = configMsg(lang);
  const isGlobal = editScope === "global";
  const field = isGlobal ? GLOBAL_FIELDS[editField] : BOT_FIELDS[editField];
  if (!field) return false;

  const label = getFieldLabel(field.key);
  const input = text.trim();
  const backData = isGlobal ? "c:g" : `c:b:${editScope}`;
  const cancelKb = {
    reply_markup: { inline_keyboard: cancelButton(backData, lang) },
  };

  if (field.type === "number") {
    const num = parseInt(input, 10);
    if (
      isNaN(num) ||
      (field.min !== undefined && num < field.min) ||
      (field.max !== undefined && num > field.max)
    ) {
      await api
        .sendMessage(chatId, cm.invalidNumber(field.min!, field.max!), cancelKb)
        .catch(() => {});
      return true;
    }

    const pool = loadPool();
    if (isGlobal) {
      savePool({ ...pool, [field.key]: num });
    } else {
      const updatedBots = pool.bots.map((b) =>
        b.username === editScope ? { ...b, [field.key]: num } : b,
      );
      savePool({ ...pool, bots: updatedBots });
    }
    log(
      `CONFIG: ${isGlobal ? "global" : `@${editScope}`}.${field.key} = ${num} by ${userId}`,
    );
    clearConversation(userId, chatId);

    const restartNote = field.restart ? `\n${cm.restartNeeded}` : "";
    await api
      .sendMessage(chatId, `${cm.saved(label, String(num))}${restartNote}`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `\u25c0\ufe0f ${common(lang).back}`,
                callback_data: backData,
              },
            ],
          ],
        },
      })
      .catch(() => {});
    return true;
  }

  // String fields
  const value = input === "none" || input === "" ? "" : input;

  if (field.key === "assignedPath" && value && !validatePath(value)) {
    await api
      .sendMessage(chatId, cm.invalidPath(value), cancelKb)
      .catch(() => {});
    return true;
  }

  // Validate whisperLanguage — only allow short alpha codes
  if (
    field.key === "whisperLanguage" &&
    value &&
    !/^[a-z]{2,10}$/i.test(value)
  ) {
    await api
      .sendMessage(chatId, cm.invalidNumber(2, 10), cancelKb)
      .catch(() => {});
    return true;
  }

  const pool = loadPool();
  if (isGlobal) {
    savePool({ ...pool, [field.key]: value });
  } else {
    const updatedBots = pool.bots.map((b) =>
      b.username === editScope ? { ...b, [field.key]: value } : b,
    );
    savePool({ ...pool, bots: updatedBots });
  }
  log(
    `CONFIG: ${isGlobal ? "global" : `@${editScope}`}.${field.key} = "${value}" by ${userId}`,
  );
  clearConversation(userId, chatId);

  const display = value || `(${lang === "zh" ? "已清除" : "cleared"})`;
  await api
    .sendMessage(chatId, cm.saved(label, display), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `\u25c0\ufe0f ${common(lang).back}`,
              callback_data: backData,
            },
          ],
        ],
      },
    })
    .catch(() => {});
  return true;
}
