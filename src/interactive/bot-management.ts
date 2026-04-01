import type { Platform } from "../platform/types.js";
import type { ManagedBot } from "../types.js";
import { mkdirSync } from "fs";
import { loadPool, savePool, createProjectBot } from "../config.js";
import { log } from "../logger.js";
import { botByUsername } from "../state.js";
import {
  getConversation,
  setConversation,
  clearConversation,
} from "./state.js";
import { validatePath, handleTokenValidation } from "./validate.js";
import {
  confirmRow,
  restartRow,
  cancelButton,
  menuButton,
  sendOrEdit,
  chunkRows,
  SEPARATOR,
  send,
  edit,
} from "./keyboards.js";
import { getLang, botsMsg, common } from "./i18n.js";

// ── Bot list ──

export async function showBotList(
  managed: ManagedBot,
  chatId: string,
  messageId?: number | string,
): Promise<void> {
  const lang = getLang();
  const m = botsMsg(lang);
  const api = managed.platform;
  const pool = loadPool();
  const bots = pool.bots;

  const lines = [m.title, `${SEPARATOR}\n`];
  if (bots.length === 0) {
    lines.push(`(empty)`);
  } else {
    for (const b of bots) {
      const name = `@${b.username ?? "?"}`;
      if (b.role === "master") {
        lines.push(`\ud83d\udc51 ${name} ${m.master}`);
      } else {
        const status = b.assignedProject ? "\ud83d\udfe2" : "\u26aa";
        const proj = b.assignedProject ?? m.unassigned;
        lines.push(`${status} ${name} \u2192 ${proj}`);
      }
    }
  }

  const projectBots = bots.filter((b) => b.role !== "master");
  const botButtons = projectBots.map((b) => ({
    text: `@${b.username ?? "?"}`,
    data: `b:d:${b.username}`,
  }));

  const rows = [
    ...chunkRows(botButtons),
    [{ text: m.addBot, data: "b:a" }],
    ...menuButton(lang),
  ];

  await sendOrEdit(api, chatId, lines.join("\n"), messageId, {
    reply_markup: { inline_keyboard: rows },
  });
}

// ── Bot detail ──

export async function showBotDetail(
  api: Platform,
  chatId: string,
  username: string,
  messageId?: number | string,
): Promise<void> {
  const lang = getLang();
  const m = botsMsg(lang);
  const c = common(lang);
  const pool = loadPool();
  const bot = pool.bots.find((b) => b.username === username);
  if (!bot) {
    await sendOrEdit(api, chatId, m.notFound(username), messageId);
    return;
  }

  const globalPm = pool.permissionMode ?? "allowAll";
  const globalAl = pool.accessLevel ?? "readWrite";
  const pmNote =
    bot.permissionMode === globalPm
      ? ` ${m.matchesGlobal}`
      : ` ${m.globalIs(globalPm)}`;
  const alNote =
    bot.accessLevel === globalAl
      ? ` ${m.matchesGlobal}`
      : ` ${m.globalIs(globalAl)}`;

  const text =
    `\ud83e\udd16 @${username}\n${SEPARATOR}\n\n` +
    `${m.project}: ${bot.assignedProject ?? m.none}\n` +
    `${m.path}: ${bot.assignedPath ?? m.none}\n` +
    `${m.access}: ${bot.accessLevel ?? "readWrite"}${alNote}\n` +
    `${m.permission}: ${bot.permissionMode ?? "allowAll"}${pmNote}\n` +
    `${m.users}: ${bot.allowedUsers?.length ?? 0}`;

  const keyboard = [
    [
      { text: m.config, data: `c:b:${username}` },
      { text: m.users, data: `u:b:${username}` },
    ],
    [
      { text: m.remove, data: `b:r:${username}` },
      { text: `\u25c0\ufe0f ${c.back}`, data: "b:l" },
    ],
  ];

  await sendOrEdit(api, chatId, text, messageId, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

// ── Callback handler ──

export async function handleBotCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number | string,
): Promise<boolean> {
  const api = managed.platform;
  const lang = getLang();
  const m = botsMsg(lang);
  const c = common(lang);

  if (data === "b:l") {
    await showBotList(managed, chatId, messageId);
    return true;
  }

  if (data === "b:a") {
    await edit(api, chatId, messageId, m.addTitle + c.replyHint, {
      reply_markup: { inline_keyboard: cancelButton("b:l", lang) },
    }).catch(() => {});
    setConversation(userId, chatId, "bot:awaitToken");
    return true;
  }

  if (data.startsWith("b:d:")) {
    const username = data.slice(4);
    await showBotDetail(api, chatId, username, messageId);
    return true;
  }

  if (data.startsWith("b:r:")) {
    const username = data.slice(4);
    await edit(api, chatId, messageId, m.confirmRemove(username), {
      reply_markup: {
        inline_keyboard: confirmRow(
          `b:xr:${username}`,
          `b:d:${username}`,
          undefined,
          undefined,
          lang,
        ),
      },
    }).catch(() => {});
    return true;
  }

  if (data.startsWith("b:xr:")) {
    const username = data.slice(5);
    const pool = loadPool();
    const filtered = pool.bots.filter((b) => b.username !== username);
    if (filtered.length === pool.bots.length) {
      await edit(api, chatId, messageId, m.notFound(username)).catch(() => {});
      return true;
    }

    savePool({ ...pool, bots: filtered });
    botByUsername.delete(username);
    log(`BOT_MGMT: removed @${username} by ${userId}`);

    await edit(api, chatId, messageId, m.removed(username), {
      reply_markup: { inline_keyboard: restartRow(lang) },
    }).catch(() => {});
    return true;
  }

  if (data === "b:confirm") {
    return await finalizeAddBot(managed, chatId, userId, messageId);
  }

  if (data === "b:mkdir") {
    const state = getConversation(userId, chatId);
    const dirPath = state?.data.pendingPath;
    if (!dirPath) return false;
    try {
      mkdirSync(dirPath, { recursive: true });
      setConversation(userId, chatId, "idle", { path: dirPath });
      const s = getConversation(userId, chatId)!;
      await edit(
        api,
        chatId,
        messageId,
        `${m.created(dirPath)}\n\n${m.summaryTitle}\n${SEPARATOR}\n\n` +
          `${m.bot}: @${s.data.username}\n` +
          `${m.project}: ${s.data.project}\n` +
          `${m.path}: ${dirPath}\n\n${common(lang).save}?`,
        {
          reply_markup: {
            inline_keyboard: confirmRow(
              "b:confirm",
              "b:l",
              undefined,
              undefined,
              lang,
            ),
          },
        },
      ).catch(() => {});
      return true;
    } catch {
      await edit(api, chatId, messageId, m.invalidPath(dirPath)).catch(
        () => {},
      );
      return true;
    }
  }

  if (data === "b:reenter") {
    const c = common(lang);
    await edit(api, chatId, messageId, m.askPath("") + c.replyHint, {
      reply_markup: { inline_keyboard: cancelButton("b:l", lang) },
    }).catch(() => {});
    return true;
  }

  return false;
}

// ── Text input handler ──

export async function handleBotText(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const state = getConversation(userId, chatId);
  if (!state) return false;

  const api = managed.platform;
  const lang = getLang();
  const m = botsMsg(lang);
  const cancelKb = {
    reply_markup: { inline_keyboard: cancelButton("b:l", lang) },
  };

  if (state.step === "bot:awaitToken") {
    return handleTokenValidation(
      api,
      chatId,
      userId,
      text,
      "bot:awaitProject",
      cancelKb,
      {
        invalidToken: m.invalidToken,
        duplicateToken: m.duplicateToken,
        validating: m.validating,
        invalidTokenApi: m.invalidTokenApi,
        foundBot: m.foundBot,
      },
    );
  }

  if (state.step === "bot:awaitProject") {
    const project = text.trim();
    if (!project || project.length > 50) {
      await send(api, chatId, m.invalidProject, cancelKb).catch(() => {});
      return true;
    }
    setConversation(userId, chatId, "bot:awaitPath", { project });
    await send(
      api,
      chatId,
      m.askPath(project) + common(lang).replyHint,
      cancelKb,
    ).catch(() => {});
    return true;
  }

  if (state.step === "bot:awaitPath") {
    const path = text.trim();
    if (!validatePath(path)) {
      const c = common(lang);
      if (path.startsWith("/")) {
        // Absolute path but doesn't exist — offer to create
        setConversation(userId, chatId, "bot:awaitPath", { pendingPath: path });
        await send(
          api,
          chatId,
          `${m.invalidPath(path)}\n\n${m.createDir(path)}`,
          {
            reply_markup: {
              inline_keyboard: confirmRow(
                "b:mkdir",
                "b:reenter",
                undefined,
                undefined,
                lang,
              ),
            },
          },
        ).catch(() => {});
      } else {
        // Not absolute path
        await send(
          api,
          chatId,
          m.invalidPath(path) + c.replyHint,
          cancelKb,
        ).catch(() => {});
      }
      return true;
    }

    setConversation(userId, chatId, "idle", { path });
    const s = getConversation(userId, chatId)!;
    await send(
      api,
      chatId,
      `${m.summaryTitle}\n${SEPARATOR}\n\n` +
        `${m.bot}: @${s.data.username}\n` +
        `${m.project}: ${s.data.project}\n` +
        `${m.path}: ${path}\n\n` +
        `${common(lang).save}?`,
      {
        reply_markup: {
          inline_keyboard: confirmRow(
            "b:confirm",
            "b:l",
            undefined,
            undefined,
            lang,
          ),
        },
      },
    ).catch(() => {});
    return true;
  }

  return false;
}

// ── Finalize ──

async function finalizeAddBot(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  messageId: number | string,
): Promise<boolean> {
  const api = managed.platform;
  const state = getConversation(userId, chatId);
  if (!state) return false;

  const { token, username, project, path } = state.data;
  if (!token || !username || !project || !path) return false;

  const lang = getLang();
  const m = botsMsg(lang);
  const pool = loadPool();
  const newBot = createProjectBot(token, username, project, path, pool);

  savePool({ ...pool, bots: [...pool.bots, newBot] });
  log(`BOT_MGMT: added @${username} → ${project} (${path}) by ${userId}`);
  clearConversation(userId, chatId);

  const { getPlatform } = await import("../config.js");
  let text = m.added(username, project, path);
  if (getPlatform() === "discord") {
    const inviteUrl = buildDiscordInviteUrl(token);
    text += `\n\n${m.inviteSteps(inviteUrl)}`;
  }

  await edit(api, chatId, messageId, text, {
    reply_markup: { inline_keyboard: restartRow(lang) },
  }).catch(() => {});
  return true;
}

function buildDiscordInviteUrl(token: string): string {
  try {
    const appId = atob(token.split(".")[0]);
    // Permissions: View Channels, Send Messages, Manage Messages, Embed Links,
    // Attach Files, Read History, Add Reactions, Use External Emojis
    return `https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot&permissions=387136`;
  } catch {
    return "";
  }
}
