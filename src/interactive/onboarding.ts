import type { Api } from "grammy";
import type { ManagedBot } from "../types.js";
import { loadPool, savePool, createProjectBot } from "../config.js";
import { log } from "../logger.js";
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
  SEPARATOR,
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
  const api = managed.bot.api;
  const pool = loadPool();
  const chatType = await getChatType(api, chatId);

  if (chatType === "private") {
    await api.sendMessage(chatId, m.dmOnly).catch(() => {});
    return;
  }

  if (pool.sharedGroupId && pool.sharedGroupId === chatId) {
    await api.sendMessage(chatId, m.alreadySet).catch(() => {});
    return;
  }

  if (pool.sharedGroupId && pool.sharedGroupId !== chatId) {
    await api.sendMessage(chatId, m.otherGroup).catch(() => {});
    return;
  }

  await api
    .sendMessage(chatId, m.welcome, {
      reply_markup: {
        inline_keyboard: confirmRow(
          "o:setgroup",
          "o:cancel",
          m.yesUseGroup,
          c.cancel,
          lang,
        ),
      },
    })
    .catch(() => {});
}

// ── Callback handlers ──

export async function handleOnboardCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const api = managed.bot.api;

  if (data === "o:setgroup") {
    const pool = loadPool();
    savePool({ ...pool, sharedGroupId: chatId });
    log(`ONBOARD: sharedGroupId set to ${chatId} by ${userId}`);

    const projectBots = pool.bots.filter((b) => b.role !== "master");
    if (projectBots.length > 0) {
      await api
        .editMessageText(chatId, messageId, m.groupDone(projectBots.length), {
          reply_markup: { inline_keyboard: restartRow(lang) },
        })
        .catch(() => {});
      clearConversation(userId, chatId);
      return true;
    }

    await api
      .editMessageText(chatId, messageId, m.groupSet, {
        reply_markup: { inline_keyboard: cancelButton("m:menu", lang) },
      })
      .catch(() => {});

    setConversation(userId, chatId, "onboard:awaitToken");
    return true;
  }

  if (data === "o:cancel") {
    const c = common(lang);
    await api.editMessageText(chatId, messageId, c.cancelled).catch(() => {});
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

    await api.editMessageText(chatId, messageId, mm.restarting).catch(() => {});
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

  const api = managed.bot.api;

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
  api: Api,
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
  api: Api,
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
    await api.sendMessage(chatId, m.invalidProject, cancelKb).catch(() => {});
    return true;
  }

  setConversation(userId, chatId, "onboard:awaitPath", { project });
  await api.sendMessage(chatId, m.askPath(project), cancelKb).catch(() => {});
  return true;
}

async function handlePathInput(
  api: Api,
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
    await api
      .sendMessage(chatId, m.invalidPath(path), cancelKb)
      .catch(() => {});
    return true;
  }

  setConversation(userId, chatId, "onboard:confirm", { path });
  const state = getConversation(userId, chatId)!;
  const { username, project } = state.data;

  await api
    .sendMessage(
      chatId,
      `${m.summary}\n${SEPARATOR}\n\n` +
        `Bot: @${username}\nProject: ${project}\nPath: ${path}\n` +
        `Access: readWrite\nPermission: allowAll\n\n${m.saveConfig}`,
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
    )
    .catch(() => {});
  return true;
}

// ── Finalize ──

async function finalizeOnboarding(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  messageId: number,
): Promise<boolean> {
  const lang = getLang();
  const m = onboardMsg(lang);
  const api = managed.bot.api;
  const state = getConversation(userId, chatId);
  if (!state) return false;

  const { token, username, project, path } = state.data;
  if (!token || !username || !project || !path) return false;

  const pool = loadPool();
  const newBot = createProjectBot(token, username, project, path, pool);

  savePool({ ...pool, bots: [...pool.bots, newBot] });
  log(`ONBOARD: added @${username} → ${project} (${path}) by ${userId}`);
  clearConversation(userId, chatId);

  await api
    .editMessageText(chatId, messageId, m.added(username, project, path), {
      reply_markup: { inline_keyboard: restartRow(lang) },
    })
    .catch(() => {});

  return true;
}

// ── Helpers ──

async function getChatType(api: Api, chatId: string): Promise<string> {
  try {
    const chat = await api.getChat(chatId);
    return chat.type;
  } catch {
    return "unknown";
  }
}
