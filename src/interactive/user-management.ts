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
import { cancelButton, menuButton } from "./keyboards.js";
import { getLang, usersMsg, common } from "./i18n.js";

// ── User management view ──

export async function showUserManagement(
  managed: ManagedBot,
  chatId: string,
  messageId?: number,
): Promise<void> {
  const lang = getLang();
  const m = usersMsg(lang);
  const api = managed.bot.api;
  const pool = loadPool();
  const admins = pool.admins ?? [];
  const projectBots = pool.bots.filter((b) => b.role !== "master");

  const lines = [
    m.title,
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n",
    m.adminsTitle,
    ...admins.map((a) => `  \u2022 ${a}`),
    "",
  ];

  if (projectBots.length > 0) {
    lines.push(m.perBotTitle);
    for (const b of projectBots) {
      const count = b.allowedUsers?.length ?? 0;
      lines.push(`  \u2022 @${b.username}: ${m.userCount(count)}`);
    }
  }

  const buttons: InlineKeyboardButton[][] = [
    [{ text: m.addAdmin, callback_data: "u:aa" }],
  ];

  if (admins.length > 0) {
    const adminBtns = admins.map((a) => ({
      text: `\u274c ${a}`,
      callback_data: `u:ra:${a}`,
    }));
    for (let i = 0; i < adminBtns.length; i += 2) {
      buttons.push(adminBtns.slice(i, i + 2));
    }
  }

  for (const b of projectBots) {
    if (b.username) {
      buttons.push([
        { text: m.botUsers(b.username), callback_data: `u:b:${b.username}` },
      ]);
    }
  }
  buttons.push(...menuButton(lang));

  const opts = { reply_markup: { inline_keyboard: buttons } };
  const text = lines.join("\n");
  if (messageId) {
    await api.editMessageText(chatId, messageId, text, opts).catch(() => {});
  } else {
    await api.sendMessage(chatId, text, opts).catch(() => {});
  }
}

// ── Bot users view ──

async function showBotUsers(
  api: Api,
  chatId: string,
  username: string,
  messageId?: number,
): Promise<void> {
  const lang = getLang();
  const m = usersMsg(lang);
  const c = common(lang);
  const pool = loadPool();
  const bot = pool.bots.find((b) => b.username === username);
  if (!bot) return;

  const users = bot.allowedUsers ?? [];
  const lines = [
    m.botUsersTitle(username),
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n",
    users.length > 0
      ? users.map((u) => `  \u2022 ${u}`).join("\n")
      : m.noUsers,
  ];

  const buttons: InlineKeyboardButton[][] = [
    [{ text: m.addUser, callback_data: `u:au:${username}` }],
  ];

  if (users.length > 0) {
    const userBtns = users.map((u) => ({
      text: `\u274c ${u}`,
      callback_data: `u:ru:${username}:${u}`,
    }));
    for (let i = 0; i < userBtns.length; i += 2) {
      buttons.push(userBtns.slice(i, i + 2));
    }
  }
  buttons.push([{ text: `\u25c0\ufe0f ${c.back}`, callback_data: "u:l" }]);

  const opts = { reply_markup: { inline_keyboard: buttons } };
  const text = lines.join("\n");
  if (messageId) {
    await api.editMessageText(chatId, messageId, text, opts).catch(() => {});
  } else {
    await api.sendMessage(chatId, text, opts).catch(() => {});
  }
}

// ── Callback handler ──

export async function handleUserCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number,
): Promise<boolean> {
  const api = managed.bot.api;
  const lang = getLang();
  const m = usersMsg(lang);
  const c = common(lang);

  if (data === "u:l") {
    await showUserManagement(managed, chatId, messageId);
    return true;
  }

  if (data === "u:aa") {
    await api
      .editMessageText(chatId, messageId, m.addAdminPrompt, {
        reply_markup: { inline_keyboard: cancelButton("u:l", lang) },
      })
      .catch(() => {});
    setConversation(userId, chatId, "user:awaitAdmin");
    return true;
  }

  if (data.startsWith("u:ra:")) {
    const adminId = data.slice(5);
    const pool = loadPool();
    const admins = pool.admins ?? [];

    if (admins.length <= 1) {
      await api
        .editMessageText(chatId, messageId, m.cantRemoveLast, {
          reply_markup: {
            inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, callback_data: "u:l" }]],
          },
        })
        .catch(() => {});
      return true;
    }

    savePool({ ...pool, admins: admins.filter((a) => a !== adminId) });
    log(`USERS: removed admin ${adminId} by ${userId}`);

    await api
      .editMessageText(chatId, messageId, m.adminRemoved(adminId), {
        reply_markup: {
          inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, callback_data: "u:l" }]],
        },
      })
      .catch(() => {});
    return true;
  }

  if (data.startsWith("u:b:")) {
    const username = data.slice(4);
    await showBotUsers(api, chatId, username, messageId);
    return true;
  }

  if (data.startsWith("u:au:")) {
    const username = data.slice(5);
    await api
      .editMessageText(chatId, messageId, m.addUserPrompt(username), {
        reply_markup: { inline_keyboard: cancelButton(`u:b:${username}`, lang) },
      })
      .catch(() => {});
    setConversation(userId, chatId, "user:awaitUser", { targetBot: username });
    return true;
  }

  if (data.startsWith("u:ru:")) {
    const rest = data.slice(5);
    const lastColon = rest.lastIndexOf(":");
    const username = rest.slice(0, lastColon);
    const targetUserId = rest.slice(lastColon + 1);

    const pool = loadPool();
    const bot = pool.bots.find((b) => b.username === username);
    if (!bot) return false;

    bot.allowedUsers = (bot.allowedUsers ?? []).filter((u) => u !== targetUserId);
    savePool(pool);
    log(`USERS: removed ${targetUserId} from @${username} by ${userId}`);

    await showBotUsers(api, chatId, username, messageId);
    return true;
  }

  return false;
}

// ── Text input handler ──

export async function handleUserText(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const state = getConversation(userId, chatId);
  if (!state) return false;

  const api = managed.bot.api;
  const lang = getLang();
  const m = usersMsg(lang);
  const input = text.trim();

  if (state.step === "user:awaitAdmin") {
    if (!/^\d+$/.test(input)) {
      await api
        .sendMessage(chatId, m.invalidId, {
          reply_markup: { inline_keyboard: cancelButton("u:l", lang) },
        })
        .catch(() => {});
      return true;
    }

    const pool = loadPool();
    const admins = pool.admins ?? [];
    if (admins.includes(input)) {
      await api.sendMessage(chatId, m.alreadyAdmin(input)).catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }

    savePool({ ...pool, admins: [...admins, input] });
    log(`USERS: added admin ${input} by ${userId}`);
    clearConversation(userId, chatId);

    await api
      .sendMessage(chatId, m.adminAdded(input), {
        reply_markup: {
          inline_keyboard: [[{ text: `\u25c0\ufe0f ${m.userMgmt}`, callback_data: "u:l" }]],
        },
      })
      .catch(() => {});
    return true;
  }

  if (state.step === "user:awaitUser") {
    const targetBot = state.data.targetBot;
    if (!/^\d+$/.test(input)) {
      await api
        .sendMessage(chatId, m.invalidId, {
          reply_markup: { inline_keyboard: cancelButton(`u:b:${targetBot}`, lang) },
        })
        .catch(() => {});
      return true;
    }

    const username = targetBot;
    if (!username) return false;

    const pool = loadPool();
    const bot = pool.bots.find((b) => b.username === username);
    if (!bot) return false;

    const users = bot.allowedUsers ?? [];
    if (users.includes(input)) {
      await api.sendMessage(chatId, m.alreadyUser(input, username)).catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }

    bot.allowedUsers = [...users, input];
    savePool(pool);
    log(`USERS: added ${input} to @${username} by ${userId}`);
    clearConversation(userId, chatId);

    await api
      .sendMessage(chatId, m.userAdded(input, username), {
        reply_markup: {
          inline_keyboard: [
            [{ text: `\u25c0\ufe0f @${username}`, callback_data: `u:b:${username}` }],
          ],
        },
      })
      .catch(() => {});
    return true;
  }

  return false;
}
