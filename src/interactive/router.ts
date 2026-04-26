// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { ManagedBot } from "../types.js";
import {
  isAdmin,
  hasPermission,
  loadPool,
  loadCron,
  saveCron,
  savePool,
  getMasterName,
  getPlatform,
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

const INTERACTIVE_PREFIXES = ["o:", "b:", "c:", "u:", "m:", "x:", "auth:"];

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
          .map((b) =>
            getPlatform() === "wechat"
              ? `  \u2022 #${b.assignedProject}`
              : `  \u2022 ${b.assignedProject} (@${b.username ?? "?"})`,
          )
          .join("\n")
      : m.none;

  const masterName = getMasterName(pool);

  const text =
    `${m.title}\n${SEPARATOR}\n\n` +
    `${m.projectsOnline(online)}\n\n` +
    `${m.projects}\n${projects}\n\n` +
    m.textCmds(masterName);

  const sentId = await sendOrEdit(managed.platform, chatId, text, messageId, {
    reply_markup: { inline_keyboard: mainMenuKeyboard(lang, userId) },
  });
  // Pre-bind ownership if userId is known
  if (sentId && userId) {
    menuOwners.set(sentId, userId);
  }
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

  // Auth request callbacks (auth:allow:<id> / auth:deny:<id>)
  if (data.startsWith("auth:")) {
    const parts = data.split(":");
    const decision = parts[1] as "allow" | "deny";
    const id = parts[2];
    if ((decision === "allow" || decision === "deny") && id) {
      const { resolveAuthRequest } = await import("../server/authRequestStore.js");
      const req = resolveAuthRequest(id, decision);
      const lang = getLang();
      if (!req) {
        const msg = lang === "zh" ? "已处理或已超时" : "Already handled or timed out";
        if (cbId) await managed.platform.answerCallback(cbId, msg).catch(() => {});
        return true;
      }
      const doneText = decision === "allow"
        ? (lang === "zh" ? `✅ 已允许 — ${req.toolName}` : `✅ Allowed — ${req.toolName}`)
        : (lang === "zh" ? `❌ 已拒绝 — ${req.toolName}` : `❌ Denied — ${req.toolName}`);
      await managed.platform.editButtons(chatId, messageId, doneText, []).catch(() => {});
      if (cbId) await managed.platform.answerCallback(cbId, "").catch(() => {});
    }
    return true;
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

  // x: = cancel + navigate back (strip all x: prefixes, no recursion)
  if (data.startsWith("x:")) {
    clearConversation(userId, chatId);
    let backData = data;
    while (backData.startsWith("x:")) backData = backData.slice(2);
    if (!backData) return false;
    return await routeCallback(
      managed,
      chatId,
      userId,
      backData,
      messageId,
      cbId,
    );
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
    await edit(api, chatId, messageId, c.noPermission, {
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
      await send(api, chatId, m.refreshing).catch(() => {});
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

    case "wecom": {
      const pool = loadPool();
      const enabled = pool.wecomEnabled ?? false;
      const publicDocs = pool.wecomPublicDocs ?? false;
      const statusText =
        lang === "zh"
          ? `\ud83d\udcc4 文档能力\n${SEPARATOR}\n\n` +
            `通过企业微信为 Claude 提供文档创建和协作能力。\n` +
            `开启后，Claude 可直接创建文档、表格、日程、会议和待办。\n\n` +
            `状态: ${enabled ? "\ud83d\udfe2 已开启" : "\u26aa 未开启"}\n` +
            `公开链接: ${publicDocs ? "\ud83d\udfe2 是（微信可直接打开）" : "\u26aa 否（需企业微信查看）"}\n\n` +
            (enabled
              ? "\ud83d\udca1 对项目 bot 说「帮我创建一个文档」即可使用"
              : "\ud83d\udca1 首次开启需要在终端完成企业微信授权")
          : `\ud83d\udcc4 Document Capability\n${SEPARATOR}\n\n` +
            `Powered by WeChat Work — gives Claude the ability to create and manage documents.\n` +
            `When enabled, Claude can create docs, spreadsheets, schedules, meetings and tasks.\n\n` +
            `Status: ${enabled ? "\ud83d\udfe2 Enabled" : "\u26aa Disabled"}\n` +
            `Public links: ${publicDocs ? "\ud83d\udfe2 Yes (viewable in WeChat)" : "\u26aa No (requires WeChat Work)"}\n\n` +
            (enabled
              ? '\ud83d\udca1 Tell a project bot "create a document" to use it'
              : "\ud83d\udca1 First-time setup requires terminal authorization");
      const toggleLabel = enabled
        ? lang === "zh"
          ? "\u23f8 关闭"
          : "\u23f8 Disable"
        : lang === "zh"
          ? "\u25b6\ufe0f 开启"
          : "\u25b6\ufe0f Enable";
      const publicLabel = publicDocs
        ? lang === "zh"
          ? "\ud83d\udd12 改为私有链接"
          : "\ud83d\udd12 Private links"
        : lang === "zh"
          ? "\ud83c\udf10 改为公开链接"
          : "\ud83c\udf10 Public links";
      const buttons = [
        [{ text: toggleLabel, data: "m:wecom:toggle" }],
        ...(enabled ? [[{ text: publicLabel, data: "m:wecom:public" }]] : []),
        ...menuButton(lang),
      ];
      await edit(api, chatId, messageId, statusText, {
        reply_markup: { inline_keyboard: buttons },
      }).catch(() => {});
      return true;
    }

    case "pushauth": {
      const pool = loadPool();
      const m = menuMsg(lang);
      const enabled = pool.pushAuthEnabled ?? false;
      const failMode = pool.pushAuthFailMode ?? "open";
      const toggleBtn = enabled
        ? { text: m.btnPushAuthToggleOff, data: "m:pushauth:toggle" }
        : { text: m.btnPushAuthToggleOn, data: "m:pushauth:toggle" };
      const failOpenBtn = { text: `${failMode === "open" ? "✓ " : ""}${m.btnFailOpen}`, data: "m:pushauth:failopen" };
      const failBlockBtn = { text: `${failMode === "block" ? "✓ " : ""}${m.btnFailBlock}`, data: "m:pushauth:failblock" };
      await edit(api, chatId, messageId, m.pushAuthSubmenu, {
        reply_markup: {
          inline_keyboard: [
            [toggleBtn],
            [failOpenBtn],
            [failBlockBtn],
            ...menuButton(lang),
          ],
        },
      }).catch(() => {});
      return true;
    }

    case "pushauth:toggle": {
      const pool = loadPool();
      const m = menuMsg(lang);
      const enabling = !(pool.pushAuthEnabled ?? false);
      savePool({ ...pool, pushAuthEnabled: enabling });
      if (enabling) await send(api, chatId, m.pushAuthEnabled);
      // Refresh submenu
      const updated = loadPool();
      const failMode = updated.pushAuthFailMode ?? "open";
      const toggleBtn = enabling
        ? { text: m.btnPushAuthToggleOff, data: "m:pushauth:toggle" }
        : { text: m.btnPushAuthToggleOn, data: "m:pushauth:toggle" };
      const failOpenBtn = { text: `${failMode === "open" ? "✓ " : ""}${m.btnFailOpen}`, data: "m:pushauth:failopen" };
      const failBlockBtn = { text: `${failMode === "block" ? "✓ " : ""}${m.btnFailBlock}`, data: "m:pushauth:failblock" };
      await edit(api, chatId, messageId, m.pushAuthSubmenu, {
        reply_markup: {
          inline_keyboard: [
            [toggleBtn],
            [failOpenBtn],
            [failBlockBtn],
            ...menuButton(lang),
          ],
        },
      }).catch(() => {});
      return true;
    }

    case "pushauth:failopen":
    case "pushauth:failblock": {
      const pool = loadPool();
      const m = menuMsg(lang);
      const newMode = action === "pushauth:failopen" ? "open" : "block";
      savePool({ ...pool, pushAuthFailMode: newMode });
      const enabled = pool.pushAuthEnabled ?? false;
      const toggleBtn = enabled
        ? { text: m.btnPushAuthToggleOff, data: "m:pushauth:toggle" }
        : { text: m.btnPushAuthToggleOn, data: "m:pushauth:toggle" };
      const failOpenBtn = { text: `${newMode === "open" ? "✓ " : ""}${m.btnFailOpen}`, data: "m:pushauth:failopen" };
      const failBlockBtn = { text: `${newMode === "block" ? "✓ " : ""}${m.btnFailBlock}`, data: "m:pushauth:failblock" };
      await edit(api, chatId, messageId, m.pushAuthSubmenu, {
        reply_markup: {
          inline_keyboard: [
            [toggleBtn],
            [failOpenBtn],
            [failBlockBtn],
            ...menuButton(lang),
          ],
        },
      }).catch(() => {});
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
      ];
      // WeChat: add docs guide
      if (getPlatform() === "wechat") {
        guideButtons.push([
          { text: "\ud83d\udcc4 文档能力", data: "m:help:docs" },
        ]);
      }
      guideButtons.push(...menuButton(lang));
      await edit(api, chatId, messageId, m.helpText, {
        reply_markup: { inline_keyboard: guideButtons },
      }).catch(() => {});
      return true;
    }

    case "restart": {
      const confirmText =
        lang === "zh"
          ? "\u26a0\ufe0f 确认重启？\n\n所有进行中的任务将被中断。\n重启后首个 menu 菜单权限属于 Owner。"
          : "\u26a0\ufe0f Confirm restart?\n\nAll in-progress tasks will be interrupted.\nThe first menu after restart will belong to the Owner.";
      await edit(api, chatId, messageId, confirmText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `\u2705 ${c.confirm}`, data: "m:restart:yes" },
              { text: `\u274c ${c.cancel}`, data: "m:menu" },
            ],
          ],
        },
      }).catch(() => {});
      return true;
    }

    default:
      break;
  }

  // Restart confirmed (re-check permission)
  if (action === "restart:yes") {
    if (!hasPermission(userId, "restart")) return true;
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

  // WeChat enterprise toggle/public
  if (action === "wecom:toggle") {
    const pool = loadPool();
    if (!pool.wecomEnabled) {
      // Enabling — check if wecom-cli is installed and configured
      const { execFileSync } = await import("child_process");
      let installed = false;
      try {
        execFileSync("which", ["wecom-cli"], { timeout: 3000 });
        installed = true;
      } catch {
        // not installed
      }

      if (!installed) {
        const guide =
          lang === "zh"
            ? "\u26a0\ufe0f 未检测到 wecom-cli\n\n" +
              "请先在终端安装：\n" +
              "  npm install -g wecom-cli\n\n" +
              "安装后回来点击「开启企微」"
            : "\u26a0\ufe0f wecom-cli not found\n\n" +
              "Install first:\n" +
              "  npm install -g wecom-cli\n\n" +
              "Then come back and enable";
        await edit(api, chatId, messageId, guide, {
          reply_markup: { inline_keyboard: menuButton(lang) },
        }).catch(() => {});
        return true;
      }

      // Check if configured — try running a simple command
      let configured = false;
      try {
        execFileSync("wecom-cli", ["contact", "get_self"], {
          timeout: 5000,
          stdio: "pipe",
        });
        configured = true;
      } catch {
        // not configured or auth failed
      }

      if (!configured) {
        const guide =
          lang === "zh"
            ? "\u26a0\ufe0f wecom-cli 未配置\n\n" +
              "请在终端执行以下命令：\n" +
              "  wecom-cli init\n\n" +
              "按提示完成企业微信授权后，回来点击「确认已授权」"
            : "\u26a0\ufe0f wecom-cli not configured\n\n" +
              "Run in terminal:\n" +
              "  wecom-cli init\n\n" +
              "Complete authorization, then tap Confirm";
        await edit(api, chatId, messageId, guide, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: lang === "zh" ? "\u2705 确认已授权" : "\u2705 Confirm",
                  data: "m:wecom:toggle",
                },
                { text: `\u25c0\ufe0f ${c.back}`, data: "m:wecom" },
              ],
            ],
          },
        }).catch(() => {});
        return true;
      }
    }

    // Toggle
    savePool({ ...pool, wecomEnabled: !pool.wecomEnabled });
    log(`CONFIG: wecomEnabled = ${!pool.wecomEnabled} by ${userId}`);
    return await handleMenuCallback(
      managed,
      chatId,
      userId,
      "m:wecom",
      messageId,
    );
  }
  if (action === "wecom:public") {
    const pool = loadPool();
    savePool({ ...pool, wecomPublicDocs: !pool.wecomPublicDocs });
    log(`CONFIG: wecomPublicDocs = ${!pool.wecomPublicDocs} by ${userId}`);
    return await handleMenuCallback(
      managed,
      chatId,
      userId,
      "m:wecom",
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
    const docsGuide =
      lang === "zh"
        ? "\ud83d\udcc4 文档能力指南\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          "通过企业微信为 Claude 提供文档协作能力。\n\n" +
          "\ud83d\ude80 支持的操作:\n" +
          "  \u2022 创建文档和表格\n" +
          "  \u2022 创建和管理日程\n" +
          "  \u2022 发起视频会议\n" +
          "  \u2022 创建和管理待办事项\n" +
          "  \u2022 查询通讯录\n\n" +
          "\ud83d\udca1 使用方式:\n" +
          "  直接对项目 bot 说「帮我写个周报文档」「创建明天的会议」\n" +
          "  Claude 会自动通过企业微信完成操作并返回链接\n\n" +
          "\u2699\ufe0f 配置:\n" +
          "  在菜单 → 文档能力中开启/关闭\n" +
          "  可设置文档为公开链接（微信可直接打开）或私有（需企业微信）\n\n" +
          "\u26a0\ufe0f 首次使用需在终端执行 wecom-cli init 完成授权"
        : "\ud83d\udcc4 Document Capability Guide\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          "Powered by WeChat Work — gives Claude document collaboration abilities.\n\n" +
          "\ud83d\ude80 Supported operations:\n" +
          "  \u2022 Create documents and spreadsheets\n" +
          "  \u2022 Create and manage calendar events\n" +
          "  \u2022 Start video meetings\n" +
          "  \u2022 Create and manage todos\n" +
          "  \u2022 Look up contacts\n\n" +
          "\ud83d\udca1 Usage:\n" +
          '  Tell a project bot "write a weekly report" or "schedule a meeting tomorrow"\n' +
          "  Claude will complete the task via WeChat Work and return a link\n\n" +
          "\u2699\ufe0f Config:\n" +
          "  Enable/disable in Menu \u2192 Document Capability\n" +
          "  Set docs to public (viewable in WeChat) or private (requires WeChat Work)\n\n" +
          "\u26a0\ufe0f First-time setup: run wecom-cli init in terminal";
    const content: Record<string, string> = {
      start: m.helpStart,
      tips: m.helpTips,
      master: m.helpMaster,
      project: m.helpProject,
      cron: m.helpCron(masterName),
      docs: docsGuide,
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
