// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { Platform } from "../platform/types.js";
import type { ManagedBot } from "../types.js";
import { loadPool, savePool, createProjectBot } from "../config.js";
import { log } from "../logger.js";
import {
  getConversation,
  setConversation,
  clearConversation,
} from "./state.js";
import {
  validatePath,
  handleTokenValidation,
  buildDiscordInviteUrl,
} from "./validate.js";
import {
  confirmRow,
  restartRow,
  cancelButton,
  SEPARATOR,
  send,
  edit,
} from "./keyboards.js";
import { getLang, onboardMsg, common } from "./i18n.js";

// ── Entry point ──

export async function startOnboarding(
  managed: ManagedBot,
  chatId: string,
  userId: string,
): Promise<void> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const c = common(lang);
  const api = managed.platform;
  const pool = loadPool();
  const chatType = await getChatType(api, chatId);

  if (chatType === "private") {
    await send(api, chatId, m.dmOnly).catch(() => {});
    return;
  }

  if (pool.sharedGroupId && pool.sharedGroupId === chatId) {
    await send(api, chatId, m.alreadySet).catch(() => {});
    return;
  }

  if (pool.sharedGroupId && pool.sharedGroupId !== chatId) {
    await send(api, chatId, m.otherGroup).catch(() => {});
    return;
  }

  await send(api, chatId, m.welcome, {
    reply_markup: {
      inline_keyboard: confirmRow(
        "o:setgroup",
        "o:cancel",
        m.yesUseGroup,
        c.cancel,
        lang,
      ),
    },
  }).catch(() => {});
}

// ── Callback handlers ──

export async function handleOnboardCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number | string,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const api = managed.platform;

  if (data === "o:setgroup") {
    const pool = loadPool();
    savePool({ ...pool, sharedGroupId: chatId });
    log(`ONBOARD: sharedGroupId set to ${chatId} by ${userId}`);

    const projectBots = pool.bots.filter((b) => b.role !== "master");
    if (projectBots.length > 0) {
      await edit(api, chatId, messageId, m.groupDone(projectBots.length), {
        reply_markup: { inline_keyboard: restartRow(lang) },
      }).catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }

    // No project bots yet — show welcome guide instead of forcing token input
    const { menuButton } = await import("./keyboards.js");
    const { botsMsg } = await import("./i18n.js");
    const bm = botsMsg(lang);

    await edit(api, chatId, messageId, m.welcomeGuide, {
      reply_markup: {
        inline_keyboard: [
          [{ text: bm.addBot, data: "b:a" }],
          ...menuButton(lang),
        ],
      },
    }).catch(() => {});

    clearConversation(userId, chatId);
    return true;
  }

  if (data === "o:cancel") {
    const c = common(lang);
    await api
      .editMessage(chatId, String(messageId), c.cancelled)
      .catch(() => {});
    clearConversation(userId, chatId);
    return true;
  }

  if (data === "o:confirm") {
    return await finalizeOnboarding(managed, chatId, userId, messageId);
  }

  if (data === "o:restart") {
    const { spawn } = await import("child_process");
    const { join } = await import("path");
    const { STATE_DIR } = await import("../config.js");
    const { menuMsg } = await import("./i18n.js");
    const mm = menuMsg(lang);

    await api
      .editMessage(chatId, String(messageId), mm.restarting)
      .catch(() => {});
    clearConversation(userId, chatId);

    setTimeout(() => {
      spawn(join(STATE_DIR, "daemon.sh"), ["restart"], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }, 1500);
    return true;
  }

  return false;
}

// ── Text input handlers ──

export async function handleOnboardText(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const state = getConversation(userId, chatId);
  if (!state) return false;

  const api = managed.platform;

  switch (state.step) {
    case "onboard:awaitToken":
      return await handleTokenInput(api, chatId, userId, text);
    case "onboard:awaitProject":
      return await handleProjectInput(api, chatId, userId, text);
    case "onboard:awaitPath":
      return await handlePathInput(api, chatId, userId, text);
    default:
      return false;
  }
}

// ── Step handlers ──

async function handleTokenInput(
  api: Platform,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const cancelKb = {
    reply_markup: { inline_keyboard: cancelButton("m:menu", lang) },
  };

  return handleTokenValidation(
    api,
    chatId,
    userId,
    text,
    "onboard:awaitProject",
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

async function handleProjectInput(
  api: Platform,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const cancelKb = {
    reply_markup: { inline_keyboard: cancelButton("m:menu", lang) },
  };
  const project = text.trim();

  if (!project || project.length > 50) {
    await send(api, chatId, m.invalidProject, cancelKb).catch(() => {});
    return true;
  }

  setConversation(userId, chatId, "onboard:awaitPath", { project });
  const c = common(lang);
  await send(api, chatId, m.askPath(project) + c.replyHint, cancelKb).catch(
    () => {},
  );
  return true;
}

async function handlePathInput(
  api: Platform,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const c = common(lang);
  const cancelKb = {
    reply_markup: { inline_keyboard: cancelButton("m:menu", lang) },
  };
  const path = text.trim();

  if (!validatePath(path)) {
    await send(api, chatId, m.invalidPath(path), cancelKb).catch(() => {});
    return true;
  }

  setConversation(userId, chatId, "onboard:confirm", { path });
  const state = getConversation(userId, chatId)!;
  const { username, project } = state.data;

  await send(
    api,
    chatId,
    `${m.summary}\n${SEPARATOR}\n\n` +
      `Bot: @${username}\nProject: ${project}\nPath: ${path}\n` +
      `Access: readWrite\nPermission: ${loadPool().permissionMode ?? "approve"}\n\n${m.saveConfig}`,
    {
      reply_markup: {
        inline_keyboard: confirmRow(
          "o:confirm",
          "o:cancel",
          undefined,
          undefined,
          lang,
        ),
      },
    },
  ).catch(() => {});
  return true;
}

// ── Finalize ──

async function finalizeOnboarding(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  messageId: number | string,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const api = managed.platform;
  const state = getConversation(userId, chatId);
  if (!state) return false;

  const { token, username, project, path } = state.data;
  if (!token || !username || !project || !path) return false;

  const pool = loadPool();
  const newBot = createProjectBot(token, username, project, path, pool);

  savePool({ ...pool, bots: [...pool.bots, newBot] });
  log(`ONBOARD: added @${username} → ${project} (${path}) by ${userId}`);
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

// ── Helpers ──

async function getChatType(_api: Platform, chatId: string): Promise<string> {
  // Telegram group IDs are negative; private chats are positive
  const id = Number(chatId);
  if (isNaN(id)) return "unknown";
  return id < 0 ? "group" : "private";
}
