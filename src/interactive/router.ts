import type { ManagedBot } from "../types.js";
import {
  isAdmin,
  hasPermission,
  loadPool,
  loadCron,
  saveCron,
  savePool,
  getMasterName,
} from "../config.js";
import { getConversation, clearConversation } from "./state.js";
import { menuOwners } from "../state.js";
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
  send,
  edit,
} from "./keyboards.js";
import { getLang, menuMsg, langMsg, common, type Lang } from "./i18n.js";
import { updateDashboard } from "../dashboard.js";

const INTERACTIVE_PREFIXES = ["o:", "b:", "c:", "u:", "m:", "x:"];

// ── Main menu ──

export async function showMainMenu(
  managed: ManagedBot,
  chatId: string,
  messageId?: number | string,
  userId?: string,
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
    reply_markup: { inline_keyboard: mainMenuKeyboard(lang, userId) },
  });
}

// ── Callback router ──

export async function routeCallback(
  managed: ManagedBot,
  chatId: string,
  userId: string,
  data: string,
  messageId: number | string,
  cbId?: string,
): Promise<boolean> {
  if (!isAdmin(userId)) return false;

  const isInteractive = INTERACTIVE_PREFIXES.some((p) => data.startsWith(p));
  if (!isInteractive) return false;

  // Menu ownership: prevent other users from clicking someone else's menu
  const msgKey = String(messageId);
  const owner = menuOwners.get(msgKey);
  if (owner && owner !== userId) {
    if (cbId) {
      const lang = getLang();
      const hint =
        lang === "zh"
          ? "请发送 menu 打开自己的菜单"
          : "Send 'menu' to open your own";
      await managed.platform.answerCallback(cbId, hint).catch(() => {});
    }
    return true;
  }
  if (!owner) {
    menuOwners.set(msgKey, userId);
  }

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
  userId: string,
  data: string,
  messageId: number | string,
): Promise<boolean> {
  const api = managed.platform;
  const action = data.slice(2);
  const lang = getLang();
  const m = menuMsg(lang);
  const c = common(lang);

  // Permission-gated menu sections
  const permGate: Record<
    string,
    "bots" | "config" | "users" | "restart" | "cron"
  > = {
    bots: "bots",
    config: "config",
    users: "users",
    restart: "restart",
    cron: "cron",
  };
  const requiredPerm =
    permGate[action] ?? (action.startsWith("cdel:") ? "cron" : undefined);
  if (requiredPerm && !hasPermission(userId, requiredPerm)) {
    await edit(api, chatId, messageId, c.noPermission ?? "\u26d4", {
      reply_markup: { inline_keyboard: menuButton(lang) },
    }).catch(() => {});
    return true;
  }

  switch (action) {
    case "menu":
      await showMainMenu(managed, chatId, messageId, userId);
      return true;

    case "bots":
      await showBotList(managed, chatId, messageId);
      return true;

    case "config":
      await showGlobalConfig(managed, chatId, messageId);
      return true;

    case "users":
      await showUserManagement(managed, chatId, messageId, userId);
      return true;

    case "status":
      void updateDashboard();
      await edit(api, chatId, messageId, m.refreshing).catch(() => {});
      return true;

    case "cron": {
      const jobs = loadCron();
      const masterName = getMasterName();
      if (jobs.length === 0) {
        await edit(api, chatId, messageId, m.noTasks(masterName), {
          reply_markup: { inline_keyboard: menuButton(lang) },
        }).catch(() => {});
      } else {
        const text =
          `${m.tasksTitle}\n${SEPARATOR}\n\n` +
          jobs
            .map((j) => {
              const status = j.enabled ? "\ud83d\udfe2" : "\u23f8";
              const last = j.lastRun ? j.lastRun.split("T")[0] : "never";
              return `${status} [${j.id}] @${j.botUsername} ${j.schedule}\n   ${j.prompt.slice(0, 60)}\n   ${m.last}: ${last}`;
            })
            .join("\n\n") +
          `\n\n${SEPARATOR}\n${m.cronGuide(masterName)}`;
        const delButtons = jobs.map((j) => [
          {
            text: `\ud83d\uddd1 ${j.id}`,
            data: `m:cdel:${j.id}`,
          },
        ]);
        await edit(api, chatId, messageId, text, {
          reply_markup: {
            inline_keyboard: [...delButtons, ...menuButton(lang)],
          },
        }).catch(() => {});
      }
      return true;
    }

    case "lang":
      await showLanguageSelector(api, chatId, lang, messageId);
      return true;

    case "help": {
      const guideButtons = [
        [
          { text: m.guideStart, data: "m:help:start" },
          { text: m.guideTips, data: "m:help:tips" },
        ],
        [
          { text: m.guideMaster, data: "m:help:master" },
          { text: m.guideProject, data: "m:help:project" },
        ],
        [{ text: m.guideCron, data: "m:help:cron" }],
        ...menuButton(lang),
      ];
      await edit(api, chatId, messageId, m.helpText, {
        reply_markup: { inline_keyboard: guideButtons },
      }).catch(() => {});
      return true;
    }

    case "restart": {
      const { spawn } = await import("child_process");
      const { join } = await import("path");
      const { STATE_DIR } = await import("../config.js");
      await edit(api, chatId, messageId, m.restarting).catch(() => {});
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

  // Cron delete: m:cdel:JOB_ID
  if (action.startsWith("cdel:")) {
    const jobId = action.slice(5);
    const jobs = loadCron();
    const filtered = jobs.filter((j) => j.id !== jobId);
    if (filtered.length < jobs.length) {
      saveCron(filtered);
    }
    // Re-render cron list
    return await handleMenuCallback(
      managed,
      chatId,
      userId,
      "m:cron",
      messageId,
    );
  }

  // Guide sub-pages: m:help:master / m:help:project / m:help:cron
  if (action.startsWith("help:")) {
    const sub = action.slice(5);
    const backToGuide = [
      [
        {
          text: `\u25c0\ufe0f ${lang === "zh" ? "返回指南" : "Back to Guide"}`,
          data: "m:help",
        },
      ],
    ];
    const masterName = getMasterName();
    const content: Record<string, string> = {
      start: m.helpStart,
      tips: m.helpTips,
      master: m.helpMaster,
      project: m.helpProject,
      cron: m.helpCron(masterName),
    };
    if (content[sub]) {
      await edit(api, chatId, messageId, content[sub], {
        reply_markup: { inline_keyboard: backToGuide },
      }).catch(() => {});
      return true;
    }
  }

  // Language set: m:lang:en / m:lang:zh
  if (action.startsWith("lang:")) {
    const newLang = action.slice(5) as Lang;
    const pool = loadPool();
    savePool({ ...pool, language: newLang });
    const lm = langMsg(newLang);
    const name = newLang === "zh" ? "中文" : "English";
    await edit(api, chatId, messageId, lm.changed(name), {
      reply_markup: { inline_keyboard: menuButton(newLang) },
    }).catch(() => {});
    return true;
  }

  return false;
}

// ── Language selector ──

async function showLanguageSelector(
  api: import("../platform/types.js").Platform,
  chatId: string,
  lang: Lang,
  messageId: number | string,
): Promise<void> {
  const lm = langMsg(lang);
  const enMark = lang === "en" ? "\u2705 " : "";
  const zhMark = lang === "zh" ? "\u2705 " : "";

  await edit(api, chatId, messageId, `${lm.title}\n\n${lm.desc}`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `${enMark}English`, data: "m:lang:en" },
          { text: `${zhMark}中文`, data: "m:lang:zh" },
        ],
        [
          {
            text: `\u25c0\ufe0f ${common(lang).menu}`,
            data: "m:menu",
          },
        ],
      ],
    },
  }).catch(() => {});
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
