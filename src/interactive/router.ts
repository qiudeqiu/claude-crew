import type { ManagedBot } from "../types.js";
import {
  isAdmin,
  loadPool,
  loadCron,
  savePool,
  getMasterName,
} from "../config.js";
import { getConversation, clearConversation } from "./state.js";
import { handleOnboardCallback, handleOnboardText } from "./onboarding.js";
import { handleBotCallback, handleBotText } from "./bot-management.js";
import { handleConfigCallback, handleConfigText } from "./config-editor.js";
import { handleUserCallback, handleUserText } from "./user-management.js";
import { showBotList } from "./bot-management.js";
import { showGlobalConfig } from "./config-editor.js";
import { showUserManagement } from "./user-management.js";
import {
  mainMenuKeyboard,
  menuButton,
  sendOrEdit,
  SEPARATOR,
} from "./keyboards.js";
import { getLang, menuMsg, langMsg, common, type Lang } from "./i18n.js";
import { updateDashboard } from "../dashboard.js";

const INTERACTIVE_PREFIXES = ["o:", "b:", "c:", "u:", "m:", "x:"];

// ── Main menu ──

export async function showMainMenu(
  managed: ManagedBot,
  chatId: string,
  messageId?: number,
): Promise<void> {
  const lang = getLang();
  const m = menuMsg(lang);
  const pool = loadPool();
  const projectBots = pool.bots.filter((b) => b.role !== "master");
  const online = projectBots.filter((b) => b.assignedProject).length;

  const projects =
    projectBots.length > 0
      ? projectBots
          .filter((b) => b.assignedProject)
          .map((b) => `  \u2022 ${b.assignedProject} (@${b.username ?? "?"})`)
          .join("\n")
      : m.none;

  const masterName = getMasterName(pool);

  const text =
    `${m.title}\n${SEPARATOR}\n\n` +
    `${m.projectsOnline(online)}\n\n` +
    `${m.projects}\n${projects}\n\n` +
    m.textCmds(masterName);

  await sendOrEdit(managed.platform, chatId, text, messageId, {
    reply_markup: { inline_keyboard: mainMenuKeyboard(lang) },
  });
}

// ── Callback router ──

export async function routeCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number,
): Promise<boolean> {
  if (!isAdmin(userId)) return false;

  const isInteractive = INTERACTIVE_PREFIXES.some((p) => data.startsWith(p));
  if (!isInteractive) return false;

  if (data.startsWith("o:")) {
    return await handleOnboardCallback(
      managed,
      chatId,
      userId,
      data,
      messageId,
    );
  }
  if (data.startsWith("b:")) {
    return await handleBotCallback(managed, chatId, userId, data, messageId);
  }
  if (data.startsWith("c:")) {
    return await handleConfigCallback(managed, chatId, userId, data, messageId);
  }
  if (data.startsWith("u:")) {
    return await handleUserCallback(managed, chatId, userId, data, messageId);
  }
  if (data.startsWith("m:")) {
    return await handleMenuCallback(managed, chatId, userId, data, messageId);
  }

  // x: = cancel + navigate back
  if (data.startsWith("x:")) {
    clearConversation(userId, chatId);
    const backData = data.slice(2);
    return await routeCallback(managed, chatId, userId, backData, messageId);
  }

  return false;
}

// ── Menu callback ──

async function handleMenuCallback(
  managed: ManagedBot,
  chatId: string,
  _userId: string,
  data: string,
  messageId: number,
): Promise<boolean> {
  const api = managed.platform;
  const action = data.slice(2);
  const lang = getLang();
  const m = menuMsg(lang);

  switch (action) {
    case "menu":
      await showMainMenu(managed, chatId, messageId);
      return true;

    case "bots":
      await showBotList(managed, chatId, messageId);
      return true;

    case "config":
      await showGlobalConfig(managed, chatId, messageId);
      return true;

    case "users":
      await showUserManagement(managed, chatId, messageId);
      return true;

    case "status":
      void updateDashboard();
      await api
        .editMessageText(chatId, messageId, m.refreshing)
        .catch(() => {});
      return true;

    case "cron": {
      const jobs = loadCron();
      const masterName = getMasterName();
      const text =
        jobs.length === 0
          ? m.noTasks(masterName)
          : `${m.tasksTitle}\n${SEPARATOR}\n\n` +
            jobs
              .map((j) => {
                const status = j.enabled ? "\ud83d\udfe2" : "\u23f8";
                const last = j.lastRun ? j.lastRun.split("T")[0] : "never";
                return `${status} [${j.id}] @${j.botUsername} ${j.schedule}\n   ${j.prompt.slice(0, 60)}\n   ${m.last}: ${last}`;
              })
              .join("\n\n");
      await api
        .editMessageText(chatId, messageId, text, {
          reply_markup: { inline_keyboard: menuButton(lang) },
        })
        .catch(() => {});
      return true;
    }

    case "lang":
      await showLanguageSelector(api, chatId, lang, messageId);
      return true;

    case "restart": {
      const { spawn } = await import("child_process");
      const { join } = await import("path");
      const { STATE_DIR } = await import("../config.js");
      await api
        .editMessageText(chatId, messageId, m.restarting)
        .catch(() => {});
      setTimeout(() => {
        spawn(join(STATE_DIR, "daemon.sh"), ["restart"], {
          detached: true,
          stdio: "ignore",
        }).unref();
      }, 1500);
      return true;
    }

    default:
      break;
  }

  // Language set: m:lang:en / m:lang:zh
  if (action.startsWith("lang:")) {
    const newLang = action.slice(5) as Lang;
    const pool = loadPool();
    savePool({ ...pool, language: newLang });
    const lm = langMsg(newLang);
    const name = newLang === "zh" ? "中文" : "English";
    await api
      .editMessageText(chatId, messageId, lm.changed(name), {
        reply_markup: { inline_keyboard: menuButton(newLang) },
      })
      .catch(() => {});
    return true;
  }

  return false;
}

// ── Language selector ──

async function showLanguageSelector(
  api: import("grammy").Api,
  chatId: string,
  lang: Lang,
  messageId: number,
): Promise<void> {
  const lm = langMsg(lang);
  const enMark = lang === "en" ? "\u2705 " : "";
  const zhMark = lang === "zh" ? "\u2705 " : "";

  await api
    .editMessageText(chatId, messageId, `${lm.title}\n\n${lm.desc}`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `${enMark}English`, callback_data: "m:lang:en" },
            { text: `${zhMark}中文`, callback_data: "m:lang:zh" },
          ],
          [
            {
              text: `\u25c0\ufe0f ${common(lang).menu}`,
              callback_data: "m:menu",
            },
          ],
        ],
      },
    })
    .catch(() => {});
}

// ── Text router ──

export async function routeText(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  if (!isAdmin(userId)) return false;

  if (/^(cancel|\/cancel)$/i.test(text.trim())) {
    const state = getConversation(userId, chatId);
    if (state && state.step !== "idle") {
      clearConversation(userId, chatId);
      const c = common(getLang());
      await managed.platform.sendMessage(chatId, c.cancelled).catch(() => {});
      return true;
    }
    return false;
  }

  const state = getConversation(userId, chatId);
  if (!state || state.step === "idle") return false;

  if (state.step.startsWith("onboard:")) {
    return await handleOnboardText(managed, chatId, userId, text);
  }
  if (state.step.startsWith("bot:")) {
    return await handleBotText(managed, chatId, userId, text);
  }
  if (state.step.startsWith("config:")) {
    return await handleConfigText(managed, chatId, userId, text);
  }
  if (state.step.startsWith("user:")) {
    return await handleUserText(managed, chatId, userId, text);
  }

  return false;
}
