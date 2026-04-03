// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { Platform } from "../platform/types.js";
import type { Button } from "../platform/types.js";
import type { ManagedBot, AdminConfig, AdminPermission } from "../types.js";
import {
  loadPool,
  savePool,
  isOwner,
  getOwner,
  hasPermission,
} from "../config.js";
import { log } from "../logger.js";
import {
  getConversation,
  setConversation,
  clearConversation,
} from "./state.js";
import {
  cancelButton,
  menuButton,
  sendOrEdit,
  chunkRows,
  SEPARATOR,
  send,
  edit,
} from "./keyboards.js";
import { getLang, usersMsg, common } from "./i18n.js";

const ALL_PERMS: AdminPermission[] = [
  "bots",
  "config",
  "users",
  "restart",
  "cron",
];

const PERM_LABELS: Record<string, Record<AdminPermission, string>> = {
  zh: {
    bots: "机器人管理",
    config: "配置编辑",
    users: "用户管理",
    restart: "重启",
    cron: "定时任务",
  },
  en: {
    bots: "Bot management",
    config: "Config",
    users: "User management",
    restart: "Restart",
    cron: "Cron",
  },
};

// ── User management view ──

export async function showUserManagement(
  managed: ManagedBot,
  chatId: string,
  messageId?: number | string,
  userId?: string,
): Promise<void> {
  const lang = getLang();
  const m = usersMsg(lang);
  const api = managed.platform;
  const pool = loadPool();
  const owner = pool.owner ?? "";
  const ownerDisplay = pool.ownerName || owner;
  const admins = pool.admins ?? [];
  const projectBots = pool.bots.filter((b) => b.role !== "master");
  const callerIsOwner = userId ? isOwner(userId) : false;

  const lines = [
    m.title,
    `${SEPARATOR}\n`,
    `\ud83d\udc51 Owner: ${ownerDisplay}`,
  ];

  if (admins.length > 0) {
    lines.push("", m.adminsTitle);
    for (const a of admins) {
      const display = a.name || a.id;
      const perms =
        a.permissions.length > 0
          ? a.permissions.map((p) => PERM_LABELS[lang]?.[p] ?? p).join(", ")
          : lang === "zh"
            ? "无权限"
            : "no permissions";
      lines.push(`  \u2022 ${display}  [${perms}]`);
    }
  }

  lines.push("");

  if (projectBots.length > 0) {
    lines.push(m.perBotTitle);
    for (const b of projectBots) {
      const count = b.allowedUsers?.length ?? 0;
      lines.push(`  \u2022 @${b.username}: ${m.userCount(count)}`);
    }
  }

  const buttons: Button[][] = [];

  // Only owner can add admins
  if (callerIsOwner) {
    buttons.push([{ text: m.addAdmin, data: "u:aa" }]);
  }

  // Admin buttons — click to enter detail page (permissions + delete)
  if (callerIsOwner && admins.length > 0) {
    for (const a of admins) {
      buttons.push([
        { text: `\u2699\ufe0f ${a.name || a.id}`, data: `u:ep:${a.id}` },
      ]);
    }
  }

  // Non-owner admin: show "leave admin" button
  if (userId && !isOwner(userId) && admins.some((a) => a.id === userId)) {
    buttons.push([
      { text: m.leaveAdmin ?? "\ud83d\udeaa", data: `u:ra:${userId}` },
    ]);
  }

  // Per-bot user management (owner or admin with "users" permission)
  const canManageUsers = userId
    ? isOwner(userId) || hasPermission(userId, "users")
    : true;
  if (canManageUsers) {
    for (const b of projectBots) {
      if (b.username) {
        buttons.push([
          { text: m.botUsers(b.username), data: `u:b:${b.username}` },
        ]);
      }
    }
  }

  buttons.push(...menuButton(lang));

  await sendOrEdit(api, chatId, lines.join("\n"), messageId, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ── Bot users view ──

async function showBotUsers(
  api: Platform,
  chatId: string,
  username: string,
  messageId?: number | string,
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
    `${SEPARATOR}\n`,
    users.length > 0 ? users.map((u) => `  \u2022 ${u}`).join("\n") : m.noUsers,
  ];

  const buttons: Button[][] = [[{ text: m.addUser, data: `u:au:${username}` }]];

  if (users.length > 0) {
    buttons.push(
      ...chunkRows(
        users.map((u) => ({
          text: `\u274c ${u}`,
          data: `u:ru:${username}:${u}`,
        })),
      ),
    );
  }
  buttons.push([{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]);

  const opts = { reply_markup: { inline_keyboard: buttons } };
  await sendOrEdit(api, chatId, lines.join("\n"), messageId, opts);
}

// ── Permission editor ──

async function showPermissionEditor(
  api: Platform,
  chatId: string,
  adminId: string,
  messageId: number | string,
): Promise<void> {
  const lang = getLang();
  const m = usersMsg(lang);
  const c = common(lang);
  const pool = loadPool();
  const admin = (pool.admins ?? []).find((a) => a.id === adminId);
  if (!admin) return;

  const display = admin.name || adminId;
  const labels = PERM_LABELS[lang] ?? PERM_LABELS.en;
  const lines = [
    m.editPermsTitle?.(display) ?? `\u2699\ufe0f ${display}`,
    `${SEPARATOR}\n`,
  ];

  const buttons: Button[][] = [];
  for (const perm of ALL_PERMS) {
    const has = admin.permissions.includes(perm);
    const icon = has ? "\u2705" : "\u274c";
    lines.push(`${icon} ${labels[perm]}`);
    buttons.push([
      {
        text: `${icon} ${labels[perm]}`,
        data: `u:tp:${adminId}:${perm}`,
      },
    ]);
  }

  // Delete button at bottom of permission page
  const removeLabel =
    lang === "zh"
      ? `\ud83d\uddd1 移除 ${display}`
      : `\ud83d\uddd1 Remove ${display}`;
  buttons.push([{ text: removeLabel, data: `u:ra:${adminId}` }]);
  buttons.push([{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]);

  await edit(api, chatId, messageId, lines.join("\n"), {
    reply_markup: { inline_keyboard: buttons },
  }).catch(() => {});
}

// ── Callback handler ──

export async function handleUserCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number | string,
): Promise<boolean> {
  const api = managed.platform;
  const lang = getLang();
  const m = usersMsg(lang);
  const c = common(lang);

  if (data === "u:l") {
    await showUserManagement(managed, chatId, messageId, userId);
    return true;
  }

  // Add admin (owner only)
  if (data === "u:aa") {
    if (!isOwner(userId)) {
      await edit(api, chatId, messageId, m.ownerOnly, {
        reply_markup: {
          inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]],
        },
      }).catch(() => {});
      return true;
    }
    await edit(api, chatId, messageId, m.addAdminPrompt + c.replyHint, {
      reply_markup: { inline_keyboard: cancelButton("u:l", lang) },
    }).catch(() => {});
    setConversation(userId, chatId, "user:awaitAdmin");
    return true;
  }

  // Remove admin
  if (data.startsWith("u:ra:")) {
    const adminId = data.slice(5);
    const pool = loadPool();

    // Cannot remove owner
    if (adminId === getOwner()) {
      await edit(api, chatId, messageId, m.cantRemoveOwner, {
        reply_markup: {
          inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]],
        },
      }).catch(() => {});
      return true;
    }

    // Non-owner can only remove themselves
    if (!isOwner(userId) && adminId !== userId) {
      await edit(api, chatId, messageId, m.ownerOnly, {
        reply_markup: {
          inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]],
        },
      }).catch(() => {});
      return true;
    }

    const admins = pool.admins ?? [];
    savePool({ ...pool, admins: admins.filter((a) => a.id !== adminId) });
    log(`USERS: removed admin ${adminId} by ${userId}`);

    await edit(api, chatId, messageId, m.adminRemoved(adminId), {
      reply_markup: {
        inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]],
      },
    }).catch(() => {});
    return true;
  }

  // Edit permissions (owner only)
  if (data.startsWith("u:ep:")) {
    if (!isOwner(userId)) {
      await edit(api, chatId, messageId, m.ownerOnly, {
        reply_markup: {
          inline_keyboard: [[{ text: `\u25c0\ufe0f ${c.back}`, data: "u:l" }]],
        },
      }).catch(() => {});
      return true;
    }
    const adminId = data.slice(5);
    await showPermissionEditor(api, chatId, adminId, messageId);
    return true;
  }

  // Toggle permission (owner only)
  if (data.startsWith("u:tp:")) {
    if (!isOwner(userId)) return true;
    const rest = data.slice(5);
    const colonIdx = rest.indexOf(":");
    const adminId = rest.slice(0, colonIdx);
    const perm = rest.slice(colonIdx + 1) as AdminPermission;
    if (!ALL_PERMS.includes(perm)) return true;

    const pool = loadPool();
    const admins = pool.admins ?? [];
    const updatedAdmins = admins.map((a) => {
      if (a.id !== adminId) return a;
      const has = a.permissions.includes(perm);
      return {
        ...a,
        permissions: has
          ? a.permissions.filter((p) => p !== perm)
          : [...a.permissions, perm],
      };
    });
    savePool({ ...pool, admins: updatedAdmins });
    log(`USERS: toggled ${perm} for admin ${adminId} by ${userId}`);
    await showPermissionEditor(api, chatId, adminId, messageId);
    return true;
  }

  if (data.startsWith("u:b:")) {
    const username = data.slice(4);
    await showBotUsers(api, chatId, username, messageId);
    return true;
  }

  if (data.startsWith("u:au:")) {
    const username = data.slice(5);
    await edit(
      api,
      chatId,
      messageId,
      m.addUserPrompt(username) + c.replyHint,
      {
        reply_markup: {
          inline_keyboard: cancelButton(`u:b:${username}`, lang),
        },
      },
    ).catch(() => {});
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

    const updatedBots = pool.bots.map((b) =>
      b.username === username
        ? {
            ...b,
            allowedUsers: (b.allowedUsers ?? []).filter(
              (u) => u !== targetUserId,
            ),
          }
        : b,
    );
    savePool({ ...pool, bots: updatedBots });
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

  const api = managed.platform;
  const lang = getLang();
  const m = usersMsg(lang);
  const input = text.trim();

  if (state.step === "user:awaitAdmin") {
    if (!/^\d+$/.test(input)) {
      await send(api, chatId, m.invalidId, {
        reply_markup: { inline_keyboard: cancelButton("u:l", lang) },
      }).catch(() => {});
      return true;
    }

    // Check if already owner or admin
    const pool = loadPool();
    if (input === getOwner()) {
      await send(api, chatId, m.alreadyAdmin(input)).catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }
    const admins = pool.admins ?? [];
    if (admins.some((a) => a.id === input)) {
      await send(api, chatId, m.alreadyAdmin(input)).catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }

    const newAdmin: AdminConfig = {
      id: input,
      permissions: ["users", "cron"],
    };
    savePool({ ...pool, admins: [...admins, newAdmin] });
    log(`USERS: added admin ${input} by ${userId}`);
    clearConversation(userId, chatId);

    await send(api, chatId, m.adminAdded(input), {
      reply_markup: {
        inline_keyboard: [
          [{ text: `\u2699\ufe0f ${m.editPerms}`, data: `u:ep:${input}` }],
          [{ text: `\u25c0\ufe0f ${m.userMgmt}`, data: "u:l" }],
        ],
      },
    }).catch(() => {});
    return true;
  }

  if (state.step === "user:awaitUser") {
    const targetBot = state.data.targetBot;
    if (!/^\d+$/.test(input)) {
      await send(api, chatId, m.invalidId, {
        reply_markup: {
          inline_keyboard: cancelButton(`u:b:${targetBot}`, lang),
        },
      }).catch(() => {});
      return true;
    }

    const username = targetBot;
    if (!username) return false;

    const pool = loadPool();
    const bot = pool.bots.find((b) => b.username === username);
    if (!bot) return false;

    const users = bot.allowedUsers ?? [];
    if (users.includes(input)) {
      await send(api, chatId, m.alreadyUser(input, username)).catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }

    const updatedBots = pool.bots.map((b) =>
      b.username === username
        ? { ...b, allowedUsers: [...(b.allowedUsers ?? []), input] }
        : b,
    );
    savePool({ ...pool, bots: updatedBots });
    log(`USERS: added ${input} to @${username} by ${userId}`);
    clearConversation(userId, chatId);

    await send(api, chatId, m.userAdded(input, username), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `\u25c0\ufe0f @${username}`,
              data: `u:b:${username}`,
            },
          ],
        ],
      },
    }).catch(() => {});
    return true;
  }

  return false;
}
