// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { Platform } from "../platform/types.js";
import type { Button } from "../platform/types.js";
import type { ManagedBot } from "../types.js";
import { loadPool, savePool, hasPermission, getPlatform } from "../config.js";
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
  restartRow,
  sendOrEdit,
  SEPARATOR,
  send,
  edit,
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
  sm: {
    key: "sessionMode",
    descKey: "sm",
    options: ["continue", "fresh"],
    optionDescKeys: ["sm_continue", "sm_fresh"],
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
  messageId?: number | string,
): Promise<void> {
  const lang = getLang();
  const cm = configMsg(lang);
  const fd = fieldDesc(lang);
  const od = optDesc(lang);
  const api = managed.platform;
  const pool = loadPool();

  const pm = pool.permissionMode ?? "approve";
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
    `\ud83e\udd16 model: ${pool.model || "(default)"}\n   ${fd.md}\n\n` +
    (getPlatform() !== "wechat" ? `\ud83d\udd10 approvers: ${pool.approvers?.length ? pool.approvers.join(", ") : "(any admin)"}\n   ${fd.ap_list}\n\n` : "") +
    `\ud83d\udd04 sessionMode: ${pool.sessionMode ?? "continue"}\n   ${fd.sm}`;

  const buttons: Button[][] = [
    [
      { text: "permissionMode", data: "c:ge:pm" },
      { text: "accessLevel", data: "c:ge:al" },
      { text: "masterExecute", data: "c:ge:me" },
    ],
    [
      { text: "maxConcurrent", data: "c:ge:mc" },
      { text: "rateLimitSeconds", data: "c:ge:rl" },
      { text: "sessionTimeout", data: "c:ge:st" },
    ],
    [
      { text: "dashboardInterval \u26a1", data: "c:ge:di" },
      { text: "model", data: "c:ge:md" },
    ],
    ...(getPlatform() !== "wechat"
      ? [[{ text: "approvers", data: "c:ge:ap_list" }, { text: "sessionMode", data: "c:ge:sm" }]]
      : [[{ text: "sessionMode", data: "c:ge:sm" }]]),
    ...menuButton(lang),
  ];

  await sendOrEdit(api, chatId, text, messageId, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ── Per-bot config view ──

export async function showBotConfig(
  api: Platform,
  chatId: string,
  username: string,
  messageId?: number | string,
): Promise<void> {
  const lang = getLang();
  const cm = configMsg(lang);
  const fd = fieldDesc(lang);
  const c = common(lang);
  const pool = loadPool();
  const bot = pool.bots.find((b) => b.username === username);
  if (!bot) return;

  const globalPm = pool.permissionMode ?? "approve";
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

  const buttons: Button[][] = [
    [
      { text: "permissionMode", data: `c:be:${username}:pm` },
      { text: "accessLevel", data: `c:be:${username}:al` },
    ],
    [
      { text: "project", data: `c:be:${username}:ap` },
      { text: "path", data: `c:be:${username}:ph` },
      { text: "model", data: `c:be:${username}:md` },
    ],
    [
      { text: "approvers", data: `c:be:${username}:ap_list` },
      { text: `\u25c0\ufe0f ${c.back}`, data: `b:d:${username}` },
    ],
  ];

  await sendOrEdit(api, chatId, text, messageId, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ── Callback handler ──

export async function handleConfigCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number | string,
): Promise<boolean> {
  if (!hasPermission(userId, "config")) return false;
  const api = managed.platform;

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
  api: Platform,
  chatId: string,
  userId: string,
  field: FieldDef,
  fieldKey: string,
  scope: string,
  messageId: number | string,
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

    const buttons: Button[][] = [];
    const row: Button[] = [];
    for (const opt of field.options) {
      const marker = opt === currentValue ? "\u2705 " : "";
      const cbData = isGlobal
        ? `c:gv:${fieldKey}:${opt}`
        : `c:bv:${scope}:${fieldKey}:${opt}`;
      row.push({ text: `${marker}${opt}`, data: cbData });
      if (row.length === 2) {
        buttons.push([...row]);
        row.length = 0;
      }
    }
    if (row.length > 0) buttons.push([...row]);

    const backData = isGlobal ? "c:g" : `c:b:${scope}`;
    buttons.push([
      { text: `\u25c0\ufe0f ${common(lang).back}`, data: backData },
    ]);

    await edit(
      api,
      chatId,
      messageId,
      `${cm.editTitle(label)}\n${desc}${restartNote}\n\n${cm.current}: ${currentValue}\n\n${optLines}`,
      { reply_markup: { inline_keyboard: buttons } },
    ).catch(() => {});
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

  await edit(
    api,
    chatId,
    messageId,
    `${cm.editTitle(label)}\n${desc}\n\n${cm.current}: ${currentValue}${rangeHint}${tipHint}${restartNote}\n\n${cm.sendValue}${common(lang).replyHint}`,
    { reply_markup: { inline_keyboard: cancelButton(backData, lang) } },
  ).catch(() => {});

  setConversation(userId, chatId, "config:awaitValue", {
    editField: fieldKey,
    editScope: scope,
  });
  return true;
}

// ── Set global value ──

async function setGlobalValue(
  api: Platform,
  chatId: string,
  userId: string,
  field: FieldDef,
  value: string,
  messageId: number | string,
): Promise<boolean> {
  const lang = getLang();
  const cm = configMsg(lang);
  const label = getFieldLabel(field.key);
  const pool = loadPool();

  let parsedValue: unknown = value;
  if (field.key === "masterExecute") parsedValue = value === "true";
  if (field.key === "approvers") {
    const ids = value
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = ids.filter((id) => !/^\d+$/.test(id));
    if (invalid.length > 0) {
      const lang = getLang();
      await send(
        api,
        chatId,
        lang === "zh"
          ? `⚠️ 无效 ID: ${invalid.join(", ")}。请输入数字用户 ID`
          : `⚠️ Invalid ID: ${invalid.join(", ")}. Please enter numeric user IDs`,
      ).catch(() => {});
      return true;
    }
    parsedValue = ids;
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
  const backRow = [{ text: `\u25c0\ufe0f ${cm.backConfig}`, data: "c:g" }];
  const buttons = field.restart
    ? [...restartRow(lang), [backRow[0]]]
    : [backRow];

  await edit(
    api,
    chatId,
    messageId,
    `${cm.saved(label, value)}${impact}${restartNote}`,
    {
      reply_markup: { inline_keyboard: buttons },
    },
  ).catch(() => {});
  return true;
}

// ── Set bot value ──

async function setBotValue(
  api: Platform,
  chatId: string,
  userId: string,
  username: string,
  field: FieldDef,
  value: string,
  messageId: number | string,
): Promise<boolean> {
  const lang = getLang();
  const cm = configMsg(lang);
  const label = getFieldLabel(field.key);
  const pool = loadPool();
  const bot = pool.bots.find((b) => b.username === username);
  if (!bot) return false;

  // Validate path if setting assignedPath
  if (field.key === "assignedPath" && value !== "inherit") {
    if (!validatePath(value)) {
      await edit(api, chatId, messageId, cm.invalidPath(value), {
        reply_markup: { inline_keyboard: menuButton(lang) },
      }).catch(() => {});
      return true;
    }
  }

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

  await edit(
    api,
    chatId,
    messageId,
    `${cm.saved(`@${username} ${label}`, value)}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `\u25c0\ufe0f ${cm.backBotConfig}`,
              data: `c:b:${username}`,
            },
          ],
        ],
      },
    },
  ).catch(() => {});
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

  const api = managed.platform;
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
      await send(
        api,
        chatId,
        cm.invalidNumber(field.min!, field.max!),
        cancelKb,
      ).catch(() => {});
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
    const backBtn = {
      text: `\u25c0\ufe0f ${common(lang).back}`,
      data: backData,
    };
    const buttons = field.restart
      ? [...restartRow(lang), [backBtn]]
      : [[backBtn]];
    await send(api, chatId, `${cm.saved(label, String(num))}${restartNote}`, {
      reply_markup: { inline_keyboard: buttons },
    }).catch(() => {});
    return true;
  }

  // String fields
  const value = input === "none" || input === "" ? "" : input;

  if (field.key === "assignedPath" && value && !validatePath(value)) {
    await send(api, chatId, cm.invalidPath(value), cancelKb).catch(() => {});
    return true;
  }

  // Parse approvers as array of numeric IDs
  let parsedValue: unknown = value;
  if (field.key === "approvers" && value) {
    const ids = value
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = ids.filter((id) => !/^\d+$/.test(id));
    if (invalid.length > 0) {
      await send(
        api,
        chatId,
        lang === "zh"
          ? `\u26a0\ufe0f 无效 ID: ${invalid.join(", ")}。请输入数字用户 ID`
          : `\u26a0\ufe0f Invalid ID: ${invalid.join(", ")}. Please enter numeric user IDs`,
        cancelKb,
      ).catch(() => {});
      return true;
    }
    parsedValue = ids;
  }

  const pool = loadPool();
  if (isGlobal) {
    savePool({ ...pool, [field.key]: parsedValue });
  } else {
    const updatedBots = pool.bots.map((b) =>
      b.username === editScope ? { ...b, [field.key]: parsedValue } : b,
    );
    savePool({ ...pool, bots: updatedBots });
  }
  log(
    `CONFIG: ${isGlobal ? "global" : `@${editScope}`}.${field.key} = "${value}" by ${userId}`,
  );
  clearConversation(userId, chatId);

  const display = value || `(${lang === "zh" ? "已清除" : "cleared"})`;
  await send(api, chatId, cm.saved(label, display), {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `\u25c0\ufe0f ${common(lang).back}`,
            data: backData,
          },
        ],
      ],
    },
  }).catch(() => {});
  return true;
}
