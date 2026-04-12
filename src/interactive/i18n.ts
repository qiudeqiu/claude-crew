// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import { loadPool, getPlatform } from "../config.js";

const EXAMPLE_HOME =
  process.platform === "darwin" ? "/Users/your-name" : "/home/your-name";

/** Is the current platform Discord? */
const isDiscord = () => getPlatform() === "discord";
/** Is the current platform Feishu/Lark? */
const isFeishu = () => getPlatform() === "feishu";
/** Is the current platform WeChat? */
const isWeChat = () => getPlatform() === "wechat";

export type Lang = "en" | "zh";

/**
 * Platform-aware syntax helpers — used in help/guide text to show
 * the correct mention/routing syntax for each platform.
 */
function mentionBot(lang: Lang, botName = "项目bot"): string {
  if (isWeChat()) return lang === "zh" ? `#${botName}` : `#${botName}`;
  return `@${botName}`;
}
function mentionMaster(lang: Lang, master = "主控"): string {
  if (isWeChat()) return lang === "zh" ? master : "master bot";
  return `@${master}`;
}
function routeHint(lang: Lang): string {
  if (isWeChat())
    return lang === "zh"
      ? "用 #项目名 + 任务描述 发送"
      : "Send with #project + task description";
  return lang === "zh"
    ? "所有命令通过 @mention 使用"
    : "All commands via @mention";
}

export function getLang(): Lang {
  try {
    const l = loadPool().language;
    return l === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

// ── Common ──

export function common(lang: Lang) {
  return lang === "zh"
    ? {
        confirm: "确认",
        cancel: "取消",
        back: "返回",
        menu: "菜单",
        restartNow: "立即重启",
        save: "保存",
        cancelled: "\u274c 已取消。",
        noPermission: "\u26d4 无权限",
        replyHint: isWeChat()
          ? "\n\n\ud83d\udca1 直接发送消息"
          : isFeishu()
            ? "\n\n\ud83d\udca1 请 @主控 发送"
            : isDiscord()
              ? "\n\n\ud83d\udca1 请 @主控 发送"
              : "\n\n\ud83d\udca1 请回复此消息或 @主控 发送",
      }
    : {
        confirm: "Confirm",
        cancel: "Cancel",
        back: "Back",
        menu: "Menu",
        restartNow: "Restart Now",
        save: "Save",
        cancelled: "\u274c Cancelled.",
        noPermission: "\u26d4 No permission",
        replyHint: isWeChat()
          ? "\n\n\ud83d\udca1 Send your message directly"
          : isFeishu()
            ? "\n\n\ud83d\udca1 Mention the master bot to respond"
            : isDiscord()
              ? "\n\n\ud83d\udca1 Mention the master bot to respond"
              : "\n\n\ud83d\udca1 Reply to this message or mention the master bot",
      };
}

// ── Main Menu ──

export function menuMsg(lang: Lang) {
  return lang === "zh"
    ? {
        title: "\ud83e\udd16 Claude Crew",
        projectsOnline: (n: number) => `\ud83d\udfe2 ${n} 个项目在线`,
        projects: "\ud83d\udcc2 项目:",
        none: "  (无)",
        textCmds: (master: string) =>
          `\ud83d\udc51 主控: @${master}\n\n` +
          "\ud83d\udcdd 文字命令（发给主控）:\n" +
          "  search <关键词> \u2014 跨项目搜索\n" +
          "  cron list / add / del \u2014 定时任务\n" +
          "  menu \u2014 呼出此菜单",
        btnBots: "\ud83e\udd16 机器人",
        btnConfig: "\u2699\ufe0f 配置",
        btnUsers: "\ud83d\udc65 用户",
        btnStatus: "\ud83d\udcca 状态",
        btnCron: "\ud83d\udccb 定时",
        btnRestart: "\ud83d\udd04 重启",
        btnLang: "\ud83c\udf10 语言",
        btnHelp: "\ud83d\udcd6 指南",
        helpText:
          "\ud83d\udcd6 使用指南\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          `每个项目一个专属 bot，${mentionBot("zh")} 即可调度任务。\n` +
          "主控机器人负责管理：添加 bot、修改配置、管理权限。\n\n" +
          `\ud83d\udca1 ${routeHint("zh")}\n\n` +
          (isWeChat()
            ? "回复数字查看各模块详细指南:"
            : "点击下方按钮查看各模块详细指南:"),
        helpMaster:
          "\ud83d\udc51 主控机器人指南\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          (isWeChat()
            ? "直接发送以下文字命令:\n"
            : "按钮菜单（发送以下文字给主控 bot）:\n") +
          "  menu \u2014 打开管理菜单\n" +
          "  bots \u2014 管理项目 Bot\n" +
          "  config \u2014 全局配置\n" +
          "  users \u2014 管理管理员和用户\n\n" +
          (isWeChat()
            ? "其他命令:\n"
            : `文字命令（需 ${mentionMaster("zh")} + 命令）:\n`) +
          "  status \u2014 刷新仪表盘\n" +
          "  restart \u2014 重启 daemon\n" +
          "  search 关键词 \u2014 搜索所有项目",
        helpProject:
          "\ud83e\udd16 项目机器人指南\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          (isWeChat()
            ? "#项目名 + 任务描述即可执行。\n直接发送消息可继续上下文对话。\n\n"
            : `${mentionBot("zh")} 后跟任务描述即可执行。\n回复 bot 消息可继续上下文对话。\n\n`) +
          "会话命令:\n" +
          "  /new \u2014 重置会话（清空上下文）\n" +
          "  /compact \u2014 压缩上下文（保留关键信息）\n\n" +
          "调整:\n" +
          "  /model sonnet|opus|haiku \u2014 切换模型\n" +
          "  /effort low|medium|high|max \u2014 思考深度\n\n" +
          "查看:\n" +
          "  /cost \u2014 累计花费\n" +
          "  /memory \u2014 项目记忆文件\n" +
          "  /status \u2014 Bot 状态",
        helpCron: (master: string) =>
          "\ud83d\udccb 定时任务指南\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          (isWeChat()
            ? "所有 cron 命令直接发送\n\n"
            : `所有 cron 命令需 ${mentionMaster("zh", master)} 发送\n\n`) +
          "添加任务:\n" +
          (isWeChat()
            ? `  cron add #项目名 HH:MM 任务描述\n`
            : `  @${master} cron add @项目bot HH:MM 任务描述\n`) +
          "    \u2514 每天定时执行\n" +
          (isWeChat()
            ? `  cron add #项目名 */N 任务描述\n`
            : `  @${master} cron add @项目bot */N 任务描述\n`) +
          "    \u2514 每 N 分钟执行一次\n\n" +
          (isWeChat()
            ? "\ud83d\udca1 #项目名 即项目标签名\n\n"
            : `\ud83d\udca1 ${mentionBot("zh")} 支持项目名或用户名\n\n`) +
          "示例:\n" +
          (isWeChat()
            ? "  cron add #api 09:00 跑测试并汇报\n  cron add #monitor */30 检查服务状态\n\n"
            : `  @${master} cron add @api_bot 09:00 跑测试并汇报\n  @${master} cron add @monitor_bot */30 检查服务状态\n\n`) +
          "管理:\n" +
          (isWeChat()
            ? "  cron list \u2014 查看任务\n  cron del <id> \u2014 删除任务"
            : `  @${master} cron list \u2014 查看任务\n  @${master} cron del <id> \u2014 删除任务`),
        guideMaster: "\ud83d\udc51 主控指南",
        guideProject: "\ud83e\udd16 项目 Bot 指南",
        guideCron: "\ud83d\udccb 定时任务指南",
        guideStart: "\ud83d\ude80 快速上手",
        guideTips: "\ud83d\udca1 使用技巧",
        helpStart:
          "\ud83d\ude80 快速上手\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          "1\ufe0f\u20e3 给项目 bot 发任务\n" +
          (isWeChat()
            ? "  #api 帮我看一下这个 bug\n\n"
            : "  @项目bot 帮我看一下这个 bug\n\n") +
          "2\ufe0f\u20e3 等待执行（实时进度可见）\n" +
          "  执行过程中显示正在操作的文件\n\n" +
          "3\ufe0f\u20e3 收到结果\n" +
          "  结果带 #项目名 标签，方便筛选\n" +
          "  直接发送消息可继续对话\n\n" +
          "4\ufe0f\u20e3 多项目并行\n" +
          (isWeChat()
            ? "  #另一个项目 同时处理其他项目\n"
            : "  @另一个bot 同时处理其他项目\n") +
          "  各项目上下文完全隔离\n\n" +
          "\ud83d\udca1 所有管理操作发送 menu 打开菜单",
        helpTips:
          "\ud83d\udca1 使用技巧\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          "\ud83d\uddbc 图片分析\n" +
          (isWeChat()
            ? "  发送截图 + #项目名 描述，Claude 会先读图再回答\n"
            : "  发送截图 + @项目bot 描述，Claude 会先读图再回答\n") +
          "  \u26a0\ufe0f 单张图片可能消耗 50K+ tokens\n\n" +
          "\ud83d\udcac 引用任意消息\n" +
          (isWeChat()
            ? "  发送文字/图片/文件，内容自动作为上下文传入\n\n"
            : "  回复任何消息（文字/图片/文件）并 @bot\n  引用内容自动作为上下文传入\n\n") +
          "\ud83d\udcb0 控制成本\n" +
          "  /model haiku \u2014 简单任务用便宜模型\n" +
          "  /effort low \u2014 降低思考深度\n" +
          "  /new \u2014 上下文膨胀时重置\n" +
          "  sessionMode: fresh \u2014 每次独立上下文\n\n" +
          "\ud83d\udd04 会话管理\n" +
          "  /compact \u2014 上下文大但不想丢失关键信息时压缩\n" +
          "  /cost \u2014 查看累计花费，掌握用量\n" +
          "  上下文到 80% 会自动提醒，95% 自动压缩",
        refreshing: "\ud83d\udcca 正在刷新看板...",
        restarting: "\ud83d\udd04 正在重启...",
        started: "\u2705 主控机器人已上线",
        noTasks: (master: string) =>
          "\ud83d\udccb 没有定时任务\n\n" +
          "\u2139\ufe0f 所有 cron 命令需 @主控 发送\n\n" +
          "语法:\n" +
          `  @${master} cron add @项目bot HH:MM 任务描述\n` +
          "    \u2514 每天定时执行\n" +
          `  @${master} cron add @项目bot */N 任务描述\n` +
          "    \u2514 每 N 分钟执行一次\n\n" +
          "示例:\n" +
          `  @${master} cron add @api_bot 09:00 跑测试并汇报\n` +
          `  @${master} cron add @monitor_bot */30 检查服务状态\n\n` +
          "管理:\n" +
          `  @${master} cron list \u2014 查看任务\n` +
          `  @${master} cron del <id> \u2014 删除任务`,
        tasksTitle: "\ud83d\udccb 定时任务",
        last: "上次",
        cronGuide: (master: string) =>
          "语法:\n" +
          `  @${master} cron add @项目bot HH:MM 任务描述\n` +
          "    \u2514 每天定时执行\n" +
          `  @${master} cron add @项目bot */N 任务描述\n` +
          "    \u2514 每 N 分钟执行一次\n\n" +
          "管理:\n" +
          `  @${master} cron list \u2014 查看任务\n` +
          `  @${master} cron del <id> \u2014 删除任务`,
      }
    : {
        title: "\ud83e\udd16 Claude Crew",
        projectsOnline: (n: number) => `\ud83d\udfe2 ${n} project(s) online`,
        projects: "\ud83d\udcc2 Projects:",
        none: "  (none)",
        textCmds: (master: string) =>
          `\ud83d\udc51 Master: @${master}\n\n` +
          "\ud83d\udcdd Text commands (send to master):\n" +
          "  search <keyword> \u2014 Search across projects\n" +
          "  cron list / add / del \u2014 Scheduled tasks\n" +
          "  menu \u2014 Show this menu",
        btnBots: "\ud83e\udd16 Bots",
        btnConfig: "\u2699\ufe0f Config",
        btnUsers: "\ud83d\udc65 Users",
        btnStatus: "\ud83d\udcca Status",
        btnCron: "\ud83d\udccb Cron",
        btnRestart: "\ud83d\udd04 Restart",
        btnLang: "\ud83c\udf10 Lang",
        btnHelp: "\ud83d\udcd6 Guide",
        helpText:
          "\ud83d\udcd6 User Guide\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          `Each project gets a dedicated bot. ${mentionBot("en", "project")} to dispatch tasks.\n` +
          "The master bot handles management: add bots, configure settings, manage access.\n\n" +
          `\ud83d\udca1 ${routeHint("en")}\n\n` +
          (isWeChat()
            ? "Reply with a number for detailed guides:"
            : "Tap a button below for detailed guides:"),
        helpMaster:
          "\ud83d\udc51 Master Bot Guide\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          (isWeChat()
            ? "Send text commands directly:\n"
            : "Button menu (send text to master bot):\n") +
          "  menu \u2014 Open management menu\n" +
          "  bots \u2014 Manage project bots\n" +
          "  config \u2014 Global settings\n" +
          "  users \u2014 Manage admins & users\n\n" +
          (isWeChat()
            ? "Other commands:\n"
            : `Text commands (${mentionMaster("en", master)} + command):\n`) +
          "  status \u2014 Refresh dashboard\n" +
          "  restart \u2014 Restart daemon\n" +
          "  search keyword \u2014 Search all projects",
        helpProject:
          "\ud83e\udd16 Project Bot Guide\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          (isWeChat()
            ? "#project + task description to execute.\nSend messages directly to continue.\n\n"
            : `${mentionBot("en", "project bot")} followed by your task.\nReply to a bot's message to continue the conversation.\n\n`) +
          "Session:\n" +
          "  /new \u2014 Reset session (clear context)\n" +
          "  /compact \u2014 Compress context (keep key info)\n\n" +
          "Tuning:\n" +
          "  /model sonnet|opus|haiku \u2014 Switch model\n" +
          "  /effort low|medium|high|max \u2014 Thinking depth\n\n" +
          "Info:\n" +
          "  /cost \u2014 Cumulative spend\n" +
          "  /memory \u2014 Project memory files\n" +
          "  /status \u2014 Bot status",
        helpCron: (master: string) =>
          "\ud83d\udccb Scheduled Tasks Guide\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          (isWeChat()
            ? "Send cron commands directly\n\n"
            : `All cron commands must be @sent to ${master}\n\n`) +
          "Add tasks:\n" +
          (isWeChat()
            ? "  cron add #project HH:MM task\n"
            : `  @${master} cron add @bot HH:MM task\n`) +
          "    \u2514 Run daily at HH:MM\n" +
          (isWeChat()
            ? "  cron add #project */N task\n"
            : `  @${master} cron add @bot */N task\n`) +
          "    \u2514 Run every N minutes\n\n" +
          (isWeChat()
            ? "\ud83d\udca1 #project is the project tag name\n\n"
            : `\ud83d\udca1 ${mentionBot("en", "bot")} accepts project name or username\n\n`) +
          "Examples:\n" +
          (isWeChat()
            ? "  cron add #api 09:00 run tests\n  cron add #monitor */30 health check\n\n"
            : `  @${master} cron add @api_bot 09:00 run tests\n  @${master} cron add @monitor_bot */30 health check\n\n`) +
          "Manage:\n" +
          (isWeChat()
            ? "  cron list \u2014 View tasks\n  cron del <id> \u2014 Delete task"
            : `  @${master} cron list \u2014 View tasks\n  @${master} cron del <id> \u2014 Delete task`),
        guideMaster: "\ud83d\udc51 Master Guide",
        guideProject: "\ud83e\udd16 Project Bot Guide",
        guideCron: "\ud83d\udccb Cron Guide",
        guideStart: "\ud83d\ude80 Quick Start",
        guideTips: "\ud83d\udca1 Tips",
        helpStart:
          "\ud83d\ude80 Quick Start\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          "1\ufe0f\u20e3 Send a task to a project bot\n" +
          "  「project bot」 fix this login bug\n\n" +
          "2\ufe0f\u20e3 Wait for execution (live progress)\n" +
          "  Bot reacts with \ud83d\udc40 when it picks up your task\n" +
          "  Shows files being read/edited in real time\n\n" +
          "3\ufe0f\u20e3 Get the result\n" +
          "  Tagged with #projectName for easy filtering\n" +
          "  Reply to continue the conversation\n\n" +
          "4\ufe0f\u20e3 Work on multiple projects\n" +
          "  @anotherbot handles a different project in parallel\n" +
          "  Each bot has fully isolated context\n\n" +
          "\ud83d\udca1 All management is done via the master bot's menu",
        helpTips:
          "\ud83d\udca1 Tips & Tricks\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
          "\ud83d\uddbc Photo analysis\n" +
          "  Send screenshot + 「project bot」 description\n" +
          "  Claude reads the image before responding\n" +
          "  \u26a0\ufe0f A single image can use 50K+ tokens\n\n" +
          "\ud83d\udcac Quote any message\n" +
          "  Reply to any message (text/photo/file) with @bot\n" +
          "  Quoted content is auto-included as context\n\n" +
          "\ud83d\udcb0 Cost control\n" +
          "  /model haiku \u2014 cheaper model for simple tasks\n" +
          "  /effort low \u2014 reduce thinking depth\n" +
          "  /new \u2014 reset when context bloats\n" +
          "  sessionMode: fresh \u2014 clean context each time\n\n" +
          "\ud83d\udd04 Session management\n" +
          "  /compact \u2014 compress without losing key info\n" +
          "  /cost \u2014 track cumulative spend\n" +
          "  Use /compact when context is high to free up space",
        refreshing: "\ud83d\udcca Refreshing dashboard...",
        restarting: "\ud83d\udd04 Restarting daemon...",
        started: "\u2705 Master bot is online",
        noTasks: (master: string) =>
          "\ud83d\udccb No scheduled tasks\n\n" +
          "\u2139\ufe0f All cron commands must be @sent to master\n\n" +
          "Syntax:\n" +
          `  @${master} cron add @bot HH:MM task\n` +
          "    \u2514 Run daily at HH:MM\n" +
          `  @${master} cron add @bot */N task\n` +
          "    \u2514 Run every N minutes\n\n" +
          "Examples:\n" +
          `  @${master} cron add @api_bot 09:00 run tests\n` +
          `  @${master} cron add @monitor_bot */30 health check\n\n` +
          "Manage:\n" +
          `  @${master} cron list \u2014 View tasks\n` +
          `  @${master} cron del <id> \u2014 Delete a task`,
        tasksTitle: "\ud83d\udccb Scheduled Tasks",
        last: "Last",
        cronGuide: (master: string) =>
          "Syntax:\n" +
          `  @${master} cron add @bot HH:MM task\n` +
          "    \u2514 Run daily at HH:MM\n" +
          `  @${master} cron add @bot */N task\n` +
          "    \u2514 Run every N minutes\n\n" +
          "Manage:\n" +
          `  @${master} cron list \u2014 View tasks\n` +
          `  @${master} cron del <id> \u2014 Delete task`,
      };
}

// ── Language selector ──

export function langMsg(lang: Lang) {
  return lang === "zh"
    ? {
        title: "\ud83c\udf10 语言 / Language",
        desc: "选择界面语言:",
        changed: (name: string) => `\u2705 已切换到${name}`,
      }
    : {
        title: "\ud83c\udf10 Language / 语言",
        desc: "Select interface language:",
        changed: (name: string) => `\u2705 Switched to ${name}`,
      };
}

// ── Bot Management ──

export function botsMsg(lang: Lang) {
  return lang === "zh"
    ? {
        title: "\ud83e\udd16 机器人池",
        master: "(主控)",
        unassigned: "未分配",
        addBot: "\u2795 添加机器人",
        project: "\ud83d\udcc2 项目",
        path: "\ud83d\udccd 路径",
        access: "\ud83d\udd10 访问级别",
        permission: "\ud83d\udee1\ufe0f 权限模式",
        users: "\ud83d\udc65 用户",
        config: "\u2699\ufe0f 配置",
        remove: "\ud83d\uddd1\ufe0f 删除",
        matchesGlobal: "(与全局一致)",
        globalIs: (v: string) => `(全局: ${v})`,
        confirmRemove: (u: string) =>
          `\u26a0\ufe0f 确定从池中删除 @${u}？\n\n此操作不可撤销。`,
        notFound: (u: string) => `\u26a0\ufe0f @${u} 未找到。`,
        removed: (u: string) =>
          `\u2705 @${u} 已从池中删除。\n\n重启后完全停止。`,
        addTitle: isWeChat()
          ? "\u2795 请输入项目名称（将作为 #标签）\n\n" +
            "添加后可以用 #项目名 + 任务描述 发送任务\n" +
            "无需额外配置，直接使用"
          : isFeishu()
            ? "\u2795 请按照以下流程添加飞书机器人：\n\n" +
              "1\ufe0f\u20e3 打开飞书开放平台 → 创建企业自建应用\n" +
              "   https://open.feishu.cn/app\n" +
              "2\ufe0f\u20e3 添加「机器人」能力\n" +
              "3\ufe0f\u20e3 权限管理 → 开通以下权限：\n" +
              "   \u2022 im:message（获取与发送消息）\n" +
              "   \u2022 im:message.group_at_msg:readonly（接收群消息）\n" +
              "   \u2022 im:message.p2p_msg:readonly（接收私聊消息）\n" +
              "   \u2022 im:message:send_as_bot（发送消息）\n" +
              "4\ufe0f\u20e3 事件与回调：\n" +
              "   事件配置 → 订阅方式「长连接」→ 添加 im.message.receive_v1\n" +
              "   回调配置 → 订阅方式「长连接」→ 添加 card.action.trigger\n" +
              "5\ufe0f\u20e3 发布版本（版本管理 → 创建版本 → 申请发布）\n" +
              "6\ufe0f\u20e3 凭证与基础信息 → 复制 App ID 和 App Secret\n" +
              "   按格式 app_id:app_secret 发送到此处\n\n" +
              "token 格式参考：\ncli_a5xxxxx:xxxxxxxxx"
            : isDiscord()
              ? "\u2795 请按照以下流程添加 Discord 机器人：\n\n" +
                "1\ufe0f\u20e3 打开 Discord Developer Portal\n" +
                "   https://discord.com/developers/applications\n" +
                "2\ufe0f\u20e3 New Application → 输入名称 → Create\n" +
                "3\ufe0f\u20e3 左侧 Bot → Reset Token → 复制 token 发送到此处\n" +
                "4\ufe0f\u20e3 开启 MESSAGE CONTENT INTENT（同页面下方）\n\n" +
                "token 格式参考：\nMTQ4ODU1.GRPIaY.cv3oBPEh..."
              : "\u2795 请按照以下流程进行机器人添加：\n\n" +
                "1\ufe0f\u20e3 点击打开 @BotFather\n" +
                "2\ufe0f\u20e3 发送 /newbot\n" +
                "3\ufe0f\u20e3 发送机器人名字（可中文）\n" +
                "4\ufe0f\u20e3 发送机器人 username（英文+数字，必须以 bot 结尾）\n" +
                "5\ufe0f\u20e3 创建完成后，看到一串 HTTP API，点击复制发送到此处\n\n" +
                "token 格式参考：\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        invalidToken: isFeishu()
          ? "\u26a0\ufe0f token 格式无效。\n格式如: cli_a5xxxxx:app_secret\n请重试:"
          : isDiscord()
            ? "\u26a0\ufe0f token 格式无效。\nDiscord token 由 3 段 base64 组成（用 . 分隔）\n请重试:"
            : "\u26a0\ufe0f token 格式无效。\n格式如: 123456789:ABCdefGHI...\n请重试:",
        duplicateToken: "\u26a0\ufe0f 此机器人已在池中。",
        validating: "\ud83d\udd0d 验证 token...",
        invalidTokenApi: isFeishu()
          ? "\u274c 无效凭证 — 飞书 API 拒绝了。\n请检查 App ID 和 App Secret 后重试:"
          : isDiscord()
            ? "\u274c 无效 token — Discord 拒绝了。\n请在 Developer Portal 重新生成后重试:"
            : "\u274c 无效 token。请重试:",
        foundBot: (u: string) =>
          `\u2705 找到 ${isDiscord() || isFeishu() ? u : "@" + u}！\n\n请输入项目名称 (如 "my-api"):`,
        invalidProject: "\u26a0\ufe0f 1-50 个字符。请重试:",
        askPath: (_p: string) =>
          `请输入项目代码所在的绝对路径:\n\n` +
          `示例: ${EXAMPLE_HOME}/projects/my-app\n` +
          `💡 以 / 开头的完整磁盘路径，不存在会提示创建`,
        invalidPath: (p: string) => `\u26a0\ufe0f 目录未找到: ${p}`,
        createDir: (p: string) => `\ud83d\udcc1 要创建目录 ${p} 吗？`,
        created: (p: string) => `\u2705 已创建: ${p}`,
        summaryTitle: "\ud83d\udcdd 添加机器人摘要",
        bot: "机器人",
        added: (u: string, proj: string, path: string) =>
          isFeishu()
            ? `\u2705 ${u} 已添加！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
              `\ud83d\udc49 下一步：\n` +
              `1\ufe0f\u20e3 在飞书开放平台发布应用版本\n` +
              `2\ufe0f\u20e3 将机器人添加到群聊\n` +
              `3\ufe0f\u20e3 点击下方「重启」按钮上线`
            : isWeChat()
              ? `\u2705 #${proj} 已添加！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 用 #${proj} 发送任务即可开始\n` +
                `点击下方「重启」按钮上线`
              : `\u2705 @${u} 已添加！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 下一步：\n` +
                `1\ufe0f\u20e3 将 @${u} 添加到本群\n` +
                `2\ufe0f\u20e3 在 @BotFather 中关闭 Group Privacy：\n` +
                `   /mybots \u2192 @${u} \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n` +
                `3\ufe0f\u20e3 点击下方「重启」按钮上线`,
        inviteSteps: (url: string) =>
          "\ud83d\udd17 邀请机器人进服务器：\n" +
          "1\ufe0f\u20e3 点击下方链接授权\n" +
          `${url}\n` +
          "2\ufe0f\u20e3 选择你的服务器 \u2192 授权\n" +
          "3\ufe0f\u20e3 确认后点击「立即重启」",
        none: "(无)",
      }
    : {
        title: "\ud83e\udd16 Bot Pool",
        master: "(master)",
        unassigned: "unassigned",
        addBot: "\u2795 Add Bot",
        project: "\ud83d\udcc2 Project",
        path: "\ud83d\udccd Path",
        access: "\ud83d\udd10 Access",
        permission: "\ud83d\udee1\ufe0f Permission",
        users: "\ud83d\udc65 Users",
        config: "\u2699\ufe0f Config",
        remove: "\ud83d\uddd1\ufe0f Remove",
        matchesGlobal: "(matches global)",
        globalIs: (v: string) => `(global: ${v})`,
        confirmRemove: (u: string) =>
          `\u26a0\ufe0f Remove @${u} from the pool?\n\nThis cannot be undone.`,
        notFound: (u: string) => `\u26a0\ufe0f @${u} not found.`,
        removed: (u: string) =>
          `\u2705 @${u} removed from pool.\n\nRestart to fully stop it.`,
        addTitle: isWeChat()
          ? "\u2795 Enter a project name (will be used as #tag)\n\n" +
            "After adding, send #project + task to dispatch.\n" +
            "No extra configuration needed."
          : isFeishu()
            ? "\u2795 Follow these steps to add a Feishu bot:\n\n" +
              "1\ufe0f\u20e3 Open Feishu Open Platform \u2192 Create custom app\n" +
              "   https://open.feishu.cn/app\n" +
              "2\ufe0f\u20e3 Add Bot capability\n" +
              "3\ufe0f\u20e3 Permissions \u2192 Enable:\n" +
              "   \u2022 im:message (send & receive messages)\n" +
              "   \u2022 im:message.group_at_msg:readonly (receive group messages)\n" +
              "   \u2022 im:message.p2p_msg:readonly (receive DMs)\n" +
              "   \u2022 im:message:send_as_bot (send messages)\n" +
              "4\ufe0f\u20e3 Events & Callbacks:\n" +
              "   Events tab \u2192 Mode: Long Connection \u2192 Add im.message.receive_v1\n" +
              "   Callbacks tab \u2192 Mode: Long Connection \u2192 Add card.action.trigger\n" +
              "5\ufe0f\u20e3 Publish a version (Version Management \u2192 Create \u2192 Publish)\n" +
              "6\ufe0f\u20e3 Credentials \u2192 Copy App ID and App Secret\n" +
              "   Send here in format: app_id:app_secret\n\n" +
              "Token format:\ncli_a5xxxxx:xxxxxxxxx"
            : isDiscord()
              ? "\u2795 Follow these steps to add a Discord bot:\n\n" +
                "1\ufe0f\u20e3 Open Discord Developer Portal\n" +
                "   https://discord.com/developers/applications\n" +
                "2\ufe0f\u20e3 New Application \u2192 enter name \u2192 Create\n" +
                "3\ufe0f\u20e3 Go to Bot \u2192 Reset Token \u2192 copy & send here\n" +
                "4\ufe0f\u20e3 Enable MESSAGE CONTENT INTENT (same page, below)\n\n" +
                "Token format:\nMTQ4ODU1.GRPIaY.cv3oBPEh..."
              : "\u2795 Follow these steps to add a bot:\n\n" +
                "1\ufe0f\u20e3 Open @BotFather\n" +
                "2\ufe0f\u20e3 Send /newbot\n" +
                "3\ufe0f\u20e3 Send the bot display name\n" +
                "4\ufe0f\u20e3 Send the bot username (must end with bot)\n" +
                "5\ufe0f\u20e3 Copy the HTTP API token and send it here\n\n" +
                "Token format:\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        invalidToken: isFeishu()
          ? "\u26a0\ufe0f Invalid token format.\nFormat: cli_a5xxxxx:app_secret\nTry again:"
          : isDiscord()
            ? "\u26a0\ufe0f Invalid token format.\nDiscord tokens are 3 base64 segments joined by dots.\nTry again:"
            : "\u26a0\ufe0f Invalid token format.\nTokens look like: 123456789:ABCdefGHI...\nTry again:",
        duplicateToken: "\u26a0\ufe0f This bot is already in the pool.",
        validating: "\ud83d\udd0d Validating token...",
        invalidTokenApi: isFeishu()
          ? "\u274c Invalid credentials \u2014 Feishu API rejected them.\nCheck App ID and App Secret, then try again:"
          : isDiscord()
            ? "\u274c Invalid token \u2014 Discord rejected it.\nRegenerate in Developer Portal and try again:"
            : "\u274c Invalid token. Try again:",
        foundBot: (u: string) =>
          `\u2705 Found ${isDiscord() || isFeishu() ? u : "@" + u}!\n\nWhat project name? (e.g. "my-api")`,
        invalidProject: "\u26a0\ufe0f 1-50 characters. Try again:",
        askPath: (_p: string) =>
          `Enter the absolute path to the project code:\n\n` +
          `Example: ${EXAMPLE_HOME}/projects/my-app\n` +
          `💡 Full disk path starting with /; will offer to create if missing`,
        invalidPath: (p: string) => `\u26a0\ufe0f Directory not found: ${p}`,
        createDir: (p: string) => `\ud83d\udcc1 Create directory ${p}?`,
        created: (p: string) => `\u2705 Created: ${p}`,
        summaryTitle: "\ud83d\udcdd Add Bot Summary",
        bot: "Bot",
        added: (u: string, proj: string, path: string) =>
          isFeishu()
            ? `\u2705 ${u} added!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
              `\ud83d\udc49 Next steps:\n` +
              `1\ufe0f\u20e3 Publish the app version on Feishu Open Platform\n` +
              `2\ufe0f\u20e3 Add the bot to your group chat\n` +
              `3\ufe0f\u20e3 Click Restart below to bring it online`
            : isWeChat()
              ? `\u2705 #${proj} added!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 Use #${proj} to send tasks\n` +
                `Click Restart below to bring it online`
              : `\u2705 @${u} added!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 Next steps:\n` +
                `1\ufe0f\u20e3 Add @${u} to this group\n` +
                `2\ufe0f\u20e3 Disable Group Privacy in @BotFather:\n` +
                `   /mybots \u2192 @${u} \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n` +
                `3\ufe0f\u20e3 Click Restart below to bring it online`,
        inviteSteps: (url: string) =>
          "\ud83d\udd17 Invite bot to server:\n" +
          "1\ufe0f\u20e3 Click the link below to authorize\n" +
          `${url}\n` +
          "2\ufe0f\u20e3 Select your server \u2192 Authorize\n" +
          "3\ufe0f\u20e3 Then click Restart Now",
        none: "(none)",
      };
}

// ── Config Editor ──

export function configMsg(lang: Lang) {
  return lang === "zh"
    ? {
        globalTitle: "\u2699\ufe0f 全局配置",
        botConfigTitle: (u: string) => `\u2699\ufe0f @${u} 配置`,
        matchesGlobal: "(= 全局)",
        globalIs: (v: string) => `(全局: ${v})`,
        editTitle: (label: string) => `\u270f\ufe0f ${label}`,
        current: "当前",
        selectValue: "选择新值:",
        sendValue: "发送新值:",
        range: (min: number, max: number) => `范围: ${min}-${max}`,
        clearHint: '发送空内容或 "none" 清除',
        tip: "提示",
        requiresRestart: "\u26a1 需要重启",
        restartNeeded: "\u26a1 需要重启才能生效",
        invalidNumber: (min: number, max: number) =>
          `\u26a0\ufe0f 需要 ${min}-${max} 之间的数字。请重试:`,
        invalidPath: (p: string) => `\u26a0\ufe0f 目录未找到: ${p}\n请重试:`,
        saved: (label: string, val: string) => `\u2705 ${label} = ${val}`,
        cleared: (label: string) => `\u2705 ${label} = (已清除)`,
        impact: (match: number, diff: number) =>
          `\ud83d\udce1 ${match} 个机器人一致, ${diff} 个不同`,
        backConfig: "返回配置",
        backBotConfig: "返回机器人配置",
        // Field labels
        permissionMode: "permissionMode",
        accessLevel: "accessLevel",
        masterExecute: "masterExecute",
        maxConcurrent: "maxConcurrent",
        rateLimitSeconds: "rateLimitSeconds",
        sessionTimeout: "sessionTimeout",
        dashboardInterval: "dashboardInterval",
        sessionMode: "sessionMode",
        assignedProject: "assignedProject",
        assignedPath: "assignedPath",
      }
    : {
        globalTitle: "\u2699\ufe0f Global Configuration",
        botConfigTitle: (u: string) => `\u2699\ufe0f @${u} Config`,
        matchesGlobal: "(= global)",
        globalIs: (v: string) => `(global: ${v})`,
        editTitle: (label: string) => `\u270f\ufe0f ${label}`,
        current: "Current",
        selectValue: "Select new value:",
        sendValue: "Send the new value:",
        range: (min: number, max: number) => `Range: ${min}-${max}`,
        clearHint: 'Send empty or "none" to clear',
        tip: "Tip",
        requiresRestart: "\u26a1 Requires restart",
        restartNeeded: "\u26a1 Restart needed to apply",
        invalidNumber: (min: number, max: number) =>
          `\u26a0\ufe0f Must be a number between ${min} and ${max}. Try again:`,
        invalidPath: (p: string) =>
          `\u26a0\ufe0f Directory not found: ${p}\nTry again:`,
        saved: (label: string, val: string) => `\u2705 ${label} = ${val}`,
        cleared: (label: string) => `\u2705 ${label} = (cleared)`,
        impact: (match: number, diff: number) =>
          `\ud83d\udce1 ${match} bot(s) match, ${diff} differ`,
        backConfig: "Back to config",
        backBotConfig: "Back to bot config",
        permissionMode: "permissionMode",
        accessLevel: "accessLevel",
        masterExecute: "masterExecute",
        maxConcurrent: "maxConcurrent",
        rateLimitSeconds: "rateLimitSeconds",
        sessionTimeout: "sessionTimeout",
        dashboardInterval: "dashboardInterval",
        sessionMode: "sessionMode",
        assignedProject: "assignedProject",
        assignedPath: "assignedPath",
      };
}

// ── Config field descriptions (bilingual) ──

export function fieldDesc(lang: Lang) {
  return lang === "zh"
    ? {
        pm: "写操作（文件编辑、Shell 命令）的授权方式",
        al: "机器人在项目中的操作权限",
        me: "允许主控机器人执行 Claude 任务（不仅仅是管理命令）",
        mc: "所有机器人的最大并行 Claude 调用数。不同订阅套餐和 API 计划允许的并发数不同，请以实际使用的模型供应商为准。",
        rl: "同一机器人两次调用之间的最小冷却秒数，防止刷屏。",
        st: "单次 Claude 调用的最大时长（分钟），超时将被终止。",
        di: "置顶看板消息的自动刷新间隔（分钟）。",
        ap: "此机器人管理的项目显示名称",
        ph: "项目目录在磁盘上的绝对路径",
        md: "Claude 模型选择。不同模型在速度、能力和成本之间有不同取舍。",
        ap_list:
          "approve 模式下必须全部同意才能执行的审批人列表。空 = 任意管理员即可。",
        sm: "会话上下文模式。continue = 接续上次对话（上下文累积），fresh = 每次独立上下文（靠 memory 恢复记忆）。",
      }
    : {
        pm: "How write operations (file edits, shell commands) are authorized",
        al: "What the bot is allowed to do in the project",
        me: "Allow the master bot to run Claude tasks (not just admin commands)",
        mc: "Maximum parallel Claude invocations across all bots. Actual concurrency depends on your subscription plan or API quota — adjust to match your provider's limits.",
        rl: "Minimum cooldown between invocations for the same bot. Prevents accidental spam.",
        st: "Maximum duration for a single Claude invocation before it's killed.",
        di: "How often the pinned dashboard message auto-refreshes.",
        ap: "Display name for the project this bot manages",
        ph: "Absolute path to the project directory on disk",
        md: "Claude model selection. Different models trade off speed, capability, and cost.",
        ap_list:
          "List of user IDs who must ALL approve before writes execute in approve mode. Empty = any admin.",
        sm: "Session context mode. continue = resume last conversation (context accumulates), fresh = clean context each time (relies on memory for continuity).",
      };
}

// ── Config option descriptions ──

export function optDesc(lang: Lang) {
  return lang === "zh"
    ? {
        pm_allowAll: "预授权所有工具 — 无提示，最快执行",
        pm_approve: "首次只读运行；需要写入时，发送按钮请求管理员批准",
        pm_auto: "Claude Code 后台安全分类器自动批准安全操作，阻止危险操作",
        pm_inherit: "使用全局 permissionMode 设置",
        al_readWrite: "完全访问 — 读文件、写文件、运行命令",
        al_readOnly: "仅读取/搜索 — 不可编辑文件，不可执行写命令",
        al_inherit: "使用全局 accessLevel 设置",
        me_true: "主控机器人可以直接执行 Claude 任务",
        me_false: "主控机器人仅处理管理命令（help、status 等）",
        md_sonnet: "均衡之选 — 速度快，能力强，性价比高",
        md_opus: "最强推理 — 复杂架构和深度分析",
        md_haiku: "最快最便宜 — 简单查询和轻量任务",
        md_inherit: "使用全局 model 设置",
        sm_continue: "接续上次对话 — 上下文累积，多轮连贯",
        sm_fresh: "每次独立上下文 — 干净高效，靠 memory 记忆",
      }
    : {
        pm_allowAll:
          "Pre-authorize all tools \u2014 no prompts, fastest execution",
        pm_approve:
          "First run read-only; if writes needed, sends a button for admin approval",
        pm_auto:
          "Claude Code\u2019s background safety classifier auto-approves safe ops, blocks dangerous ones",
        pm_inherit: "Use the global permissionMode setting",
        al_readWrite:
          "Full access \u2014 read files, write files, run commands",
        al_readOnly: "Read/search only \u2014 no file edits, no write commands",
        al_inherit: "Use the global accessLevel setting",
        me_true: "Master bot can execute Claude tasks when messaged directly",
        me_false: "Master bot only handles admin commands (help, status, etc.)",
        md_sonnet: "Balanced \u2014 fast, capable, cost-effective",
        md_opus:
          "Strongest reasoning \u2014 complex architecture and deep analysis",
        md_haiku:
          "Fastest and cheapest \u2014 simple queries and lightweight tasks",
        md_inherit: "Use the global model setting",
        sm_continue:
          "Resume last conversation \u2014 context accumulates, multi-turn coherence",
        sm_fresh:
          "Clean context each time \u2014 efficient, relies on memory for continuity",
      };
}

// ── Config field hints ──

export function fieldHint(lang: Lang) {
  return lang === "zh"
    ? {
        mc: "参考: Pro 2-3, Max 5-10, API 按额度调整",
        rl: "0 = 无冷却, 5 = 推荐默认值",
        st: "10 = 默认值, 长任务可调高",
        di: "30 = 默认值。值越小 API 调用越频繁",
        ap: '如 "my-api"、"frontend"',
        ph: "如 /home/user/projects/my-api",
        ap_list:
          '用空格或逗号分隔多个 user ID，如 "123456 789012"。空 = 任意管理员',
      }
    : {
        mc: "Reference: Pro 2-3, Max 5-10, API key adjust to your quota",
        rl: "0 = no cooldown, 5 = recommended default",
        st: "10 = default, increase for long-running tasks",
        di: "30 = default. Lower values increase API calls",
        ap: 'e.g. "my-api", "frontend"',
        ph: "e.g. /home/user/projects/my-api",
        ap_list:
          'Space or comma separated user IDs, e.g. "123456 789012". Empty = any admin',
      };
}

// ── User Management ──

export function usersMsg(lang: Lang) {
  return lang === "zh"
    ? {
        title: "\ud83d\udc65 用户管理",
        adminsTitle: "\ud83d\udd27 管理员:",
        perBotTitle: "\ud83e\udd16 机器人用户:",
        userCount: (n: number) => (n > 0 ? `${n} 个用户` : "无"),
        addAdmin: "\u2795 添加管理员",
        botUsers: (u: string) => `\ud83d\udc65 @${u} 用户`,
        addAdminPrompt: isWeChat()
          ? "\ud83d\udc51 添加管理员\n\n发送用户的微信 ID（xxx@im.wechat 格式）:"
          : isFeishu()
            ? "\ud83d\udc51 添加管理员\n\n发送用户的 Open ID。\n\n提示: 在飞书管理后台 → 成员管理中查看 Open ID\n\n添加后可编辑其菜单权限。"
            : isDiscord()
              ? "\ud83d\udc51 添加管理员\n\n发送 Discord 用户 ID（数字）。\n\n提示: 开启开发者模式后右键用户 \u2192 复制用户 ID"
              : "\ud83d\udc51 添加管理员\n\n发送 Telegram 用户 ID（数字）。\n\n提示: 可通过 @userinfobot 获取 ID\n\n添加后可编辑其菜单权限。",
        ownerOnly: "\u26d4 仅 Owner 可执行此操作。",
        cantRemoveOwner: "\u26d4 Owner 不可被移除。",
        adminRemoved: (id: string) => `\u2705 管理员 ${id} 已移除。`,
        editPermsTitle: (id: string) => `\u2699\ufe0f 编辑 ${id} 的权限`,
        editPerms: "编辑权限",
        leaveAdmin: "\ud83d\udeaa 退出管理员",
        botUsersTitle: (u: string) => `\ud83d\udc65 @${u} 用户`,
        noUsers: "  (无用户 \u2014 管理员始终有权限)",
        addUser: "\u2795 添加用户",
        addUserPrompt: (u: string) =>
          isWeChat()
            ? `\ud83d\udc65 添加用户到 #${u}\n\n发送用户微信 ID（xxx@im.wechat）:`
            : isFeishu()
              ? `\ud83d\udc65 添加用户到 ${u}\n\n发送用户 Open ID:`
              : isDiscord()
                ? `\ud83d\udc65 添加用户到 ${u}\n\n发送 Discord 用户 ID（数字）:`
                : `\ud83d\udc65 添加用户到 @${u}\n\n发送 Telegram 用户 ID（数字）:`,
        invalidId: isWeChat()
          ? "\u26a0\ufe0f 请输入微信 ID（如 xxx@im.wechat）。\n请重试:"
          : isFeishu()
            ? "\u26a0\ufe0f 请输入用户 Open ID（如 ou_xxxxx）。\n请重试:"
            : "\u26a0\ufe0f 用户 ID 必须是数字（如 123456789）。\n请重试:",
        alreadyAdmin: (id: string) => `\u26a0\ufe0f ${id} 已是管理员。`,
        adminAdded: (id: string) =>
          `\u2705 管理员已添加: ${id}\n\n默认权限：用户管理、定时任务。点击下方编辑更多权限。`,
        userMgmt: "用户管理",
        alreadyUser: (id: string, u: string) =>
          `\u26a0\ufe0f ${id} 已有 @${u} 的权限。`,
        userAdded: (id: string, u: string) =>
          `\u2705 用户 ${id} 已添加到 @${u}`,
      }
    : {
        title: "\ud83d\udc65 User Management",
        adminsTitle: "\ud83d\udd27 Admins:",
        perBotTitle: "\ud83e\udd16 Per-bot users:",
        userCount: (n: number) => (n > 0 ? `${n} user(s)` : "none"),
        addAdmin: "\u2795 Add Admin",
        botUsers: (u: string) => `\ud83d\udc65 @${u} users`,
        addAdminPrompt: isWeChat()
          ? "\ud83d\udc51 Add Admin\n\nSend the user's WeChat ID (xxx@im.wechat format):"
          : isFeishu()
            ? "\ud83d\udc51 Add Admin\n\nSend the user's Open ID.\n\nTip: find Open IDs in Feishu Admin Console \u2192 Member Management\n\nYou can edit their menu permissions after adding."
            : isDiscord()
              ? "\ud83d\udc51 Add Admin\n\nSend the Discord user ID (numeric).\n\nTip: enable Developer Mode, right-click user \u2192 Copy User ID"
              : "\ud83d\udc51 Add Admin\n\nSend the Telegram user ID (numeric).\n\nTip: users can find their ID via @userinfobot\n\nYou can edit their menu permissions after adding.",
        ownerOnly: "\u26d4 Only the Owner can do this.",
        cantRemoveOwner: "\u26d4 The Owner cannot be removed.",
        adminRemoved: (id: string) => `\u2705 Admin ${id} removed.`,
        editPermsTitle: (id: string) =>
          `\u2699\ufe0f Edit permissions for ${id}`,
        editPerms: "Edit permissions",
        leaveAdmin: "\ud83d\udeaa Leave admin",
        botUsersTitle: (u: string) => `\ud83d\udc65 @${u} Users`,
        noUsers: "  (no users \u2014 admins always have access)",
        addUser: "\u2795 Add User",
        addUserPrompt: (u: string) =>
          isWeChat()
            ? `\ud83d\udc65 Add user to #${u}\n\nSend WeChat ID (xxx@im.wechat):`
            : isFeishu()
              ? `\ud83d\udc65 Add user to ${u}\n\nSend the user's Open ID:`
              : isDiscord()
                ? `\ud83d\udc65 Add user to ${u}\n\nSend the Discord user ID (numeric):`
                : `\ud83d\udc65 Add user to @${u}\n\nSend the Telegram user ID (numeric):`,
        invalidId: isWeChat()
          ? "\u26a0\ufe0f Please enter WeChat ID (e.g. xxx@im.wechat).\nTry again:"
          : isFeishu()
            ? "\u26a0\ufe0f Please enter a valid Open ID (e.g. ou_xxxxx).\nTry again:"
            : "\u26a0\ufe0f User ID must be numeric (e.g. 123456789).\nTry again:",
        alreadyAdmin: (id: string) => `\u26a0\ufe0f ${id} is already an admin.`,
        adminAdded: (id: string) =>
          `\u2705 Admin added: ${id}\n\nDefault permissions: Users, Cron. Tap below to grant more.`,
        userMgmt: "User management",
        alreadyUser: (id: string, u: string) =>
          `\u26a0\ufe0f ${id} already has access to @${u}.`,
        userAdded: (id: string, u: string) =>
          `\u2705 User ${id} added to @${u}`,
      };
}

// ── Onboarding ──

export function onboardMsg(lang: Lang) {
  return lang === "zh"
    ? {
        dmOnly: isWeChat()
          ? "\ud83d\udc4b 欢迎！我是你的 Claude Crew 主控机器人。\n\n" +
            "发送 setup 开始设置向导\n" +
            "发送 menu 打开管理菜单 \ud83d\ude80"
          : isFeishu()
            ? "\ud83d\udc4b 欢迎！我是你的 Claude Crew 主控机器人。\n\n" +
              "请在群聊中 @我 并发送 setup 开始设置向导 \ud83d\ude80"
            : isDiscord()
              ? "\ud83d\udc4b 欢迎！我是你的 Claude Crew 主控机器人。\n\n" +
                "请在服务器的文字频道中 @我 并发送 setup 开始设置向导 \ud83d\ude80"
              : "\ud83d\udc4b 欢迎！我是你的 Claude Crew 主控机器人。\n\n" +
                "下一步：\n" +
                "1\ufe0f\u20e3 创建一个 Telegram 私密群组\n" +
                "2\ufe0f\u20e3 把我拉进群组\n" +
                "3\ufe0f\u20e3 在 @BotFather 中关闭我的 Group Privacy：\n" +
                "   /mybots \u2192 选择我 \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n\n" +
                "拉进群后我会自动发起设置向导 \ud83d\ude80",
        needAdmin: isWeChat()
          ? "\ud83d\udc4b 已连接！发送 menu 开始管理。"
          : "\ud83d\udc4b 我已加入群组！\n\n\u26a0\ufe0f 请先将我设为群组管理员，这样我才能置顶看板和管理消息。\n\n操作：群组设置 \u2192 管理员 \u2192 添加我 \u2192 保存",
        groupDetected: isWeChat()
          ? "\u2705 已就绪！发送 menu 管理项目。"
          : "\u2705 管理员权限已就绪！\n\n是否将此群组设为共享控制群组？\n\n设置后，所有项目机器人和管理操作都将在此群组中进行。",
        alreadySet: isWeChat()
          ? "\u2705 已配置。使用 config 管理设置。"
          : "\u2705 此群组已配置为共享群组。\n\n使用 config 管理设置。",
        otherGroup: isWeChat()
          ? "\u26a0\ufe0f 已在其他对话中配置。"
          : "\u26a0\ufe0f 共享群组已在其他聊天中配置。\n\n请在该群组中使用 config 修改。",
        welcome: isWeChat()
          ? "\ud83d\udc4b 欢迎使用 Claude Crew!\n\n" +
            "发送 bots 添加项目，用 #项目名 发送任务。"
          : "\ud83d\udc4b 欢迎使用 Claude Crew 设置!\n\n" +
            "将配置:\n" +
            "1\ufe0f\u20e3 设置此群组为共享控制群组\n" +
            "2\ufe0f\u20e3 添加你的第一个项目机器人\n\n" +
            "使用此群组作为共享控制群组?",
        yesUseGroup: isWeChat() ? "是，开始" : "是，使用此群组",
        groupDone: (n: number) =>
          isWeChat()
            ? `\u2705 已配置！你已有 ${n} 个项目。\n\n\ud83d\udd04 重启以应用更改。`
            : `\u2705 群组已配置！\n\n你已有 ${n} 个项目机器人。\n它们将在此群组发布更新。\n\n\ud83d\udd04 重启以应用更改。`,
        groupSet: isFeishu()
          ? "\u2705 群组已设置！\n\n" +
            "现在添加你的第一个项目机器人：\n\n" +
            "1\ufe0f\u20e3 打开飞书开放平台\n" +
            "   https://open.feishu.cn/app\n" +
            "2\ufe0f\u20e3 创建企业自建应用 → 添加「机器人」能力\n" +
            "3\ufe0f\u20e3 复制 App ID 和 App Secret\n" +
            "4\ufe0f\u20e3 按格式 app_id:app_secret 发送到此处\n\n" +
            "token 格式参考：\ncli_a5xxxxx:xxxxxxxxx"
          : isDiscord()
            ? "\u2705 频道已设置！\n\n" +
              "现在添加你的第一个项目机器人：\n\n" +
              "1\ufe0f\u20e3 打开 Discord Developer Portal\n" +
              "   https://discord.com/developers/applications\n" +
              "2\ufe0f\u20e3 New Application \u2192 输入名称 \u2192 Create\n" +
              "3\ufe0f\u20e3 左侧 Bot \u2192 Reset Token \u2192 复制 token 发送到此处\n" +
              "4\ufe0f\u20e3 开启 MESSAGE CONTENT INTENT\n\n" +
              "token 格式参考：\nMTQ4ODU1.GRPIaY.cv3oBPEh..."
            : "\u2705 群组已设置！\n\n" +
              "现在添加你的第一个项目机器人：\n\n" +
              "1\ufe0f\u20e3 点击打开 @BotFather\n" +
              "2\ufe0f\u20e3 发送 /newbot\n" +
              "3\ufe0f\u20e3 发送机器人名字（可中文）\n" +
              "4\ufe0f\u20e3 发送机器人 username（英文+数字，必须以 bot 结尾）\n" +
              "5\ufe0f\u20e3 创建完成后，看到一串 HTTP API，点击复制发送到此处\n\n" +
              "token 格式参考：\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        welcomeGuide: isFeishu()
          ? "\u2705 群组设置完成！\n\n" +
            "\ud83c\udf89 下一步：\n\n" +
            "\u2022 点击「添加 Bot」为你的项目创建专属 bot\n" +
            "\u2022 添加后在群里 @提及项目 bot 即可让 Claude Code 执行任务\n" +
            "\u2022 发送 menu 给主控 bot 随时打开管理菜单\n\n" +
            "\ud83d\udca1 项目 bot 需要先在飞书开放平台创建应用，拿到凭证后在这里添加"
          : isDiscord()
            ? "\u2705 频道设置完成！\n\n" +
              "\ud83c\udf89 下一步：\n\n" +
              "\u2022 点击「添加 Bot」为你的项目创建专属 bot\n" +
              "\u2022 添加后在频道中 @提及项目 bot 即可让 Claude Code 执行任务\n" +
              "\u2022 发送 menu 给主控 bot 随时打开管理菜单\n\n" +
              "\ud83d\udca1 项目 bot 需要先在 Developer Portal 创建，拿到 token 后在这里添加"
            : "\u2705 群组设置完成！\n\n" +
              "\ud83c\udf89 下一步：\n\n" +
              "\u2022 点击「添加 Bot」为你的项目创建专属 bot\n" +
              "\u2022 添加后在群里 @提及项目 bot 即可让 Claude Code 执行任务\n" +
              "\u2022 发送 menu 给主控 bot 随时打开管理菜单\n\n" +
              "\ud83d\udca1 项目 bot 需要先在 @BotFather 创建，拿到 token 后在这里添加",
        invalidToken: isFeishu()
          ? "\u26a0\ufe0f 这不像飞书应用凭证。\n\n格式如: cli_a5xxxxx:app_secret\n请检查后重试:"
          : isDiscord()
            ? "\u26a0\ufe0f 这不像一个 bot token。\n\nDiscord token 由 3 段 base64 组成（用 . 分隔）\n请在 Developer Portal 重新获取后重试:"
            : "\u26a0\ufe0f 这不像一个 bot token。\n\n" +
              "token 格式如: 123456789:ABCdefGHI...\n" +
              "从 @BotFather 获取后重试:",
        duplicateToken: "\u26a0\ufe0f 此机器人已在池中。\n请发送其他 token:",
        validating: "\ud83d\udd0d 验证 token...",
        invalidTokenApi: isFeishu()
          ? "\u274c 无效凭证 — 飞书 API 拒绝了。\n请检查 App ID 和 App Secret 后重试:"
          : isDiscord()
            ? "\u274c 无效 token — Discord 拒绝了。\n请在 Developer Portal 重新生成后重试:"
            : "\u274c 无效 token — Telegram 拒绝了。\n请检查 @BotFather 后重试:",
        foundBot: (u: string) =>
          `\u2705 找到 @${u}！\n\n请输入项目名称 (如 "my-api"、"frontend"):`,
        invalidProject: "\u26a0\ufe0f 项目名称应为 1-50 个字符。\n请重试:",
        askPath: (_p: string) =>
          `请输入项目代码所在的绝对路径:\n\n` +
          `示例: ${EXAMPLE_HOME}/projects/my-app\n` +
          `💡 以 / 开头的完整磁盘路径，不存在会提示创建`,
        invalidPath: (p: string) =>
          `\u26a0\ufe0f 目录未找到: ${p}\n请输入绝对路径，如 ${EXAMPLE_HOME}/projects/xxx`,
        createDir: (p: string) => `\ud83d\udcc1 要创建目录 ${p} 吗？`,
        created: (p: string) => `\u2705 已创建: ${p}`,
        summary: "\ud83d\udcdd 设置摘要",
        saveConfig: "保存此配置?",
        added: (u: string, proj: string, path: string) =>
          isFeishu()
            ? `\u2705 ${u} 已添加到池中！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
              `\ud83d\udc49 下一步：\n` +
              `1\ufe0f\u20e3 在飞书开放平台发布应用版本\n` +
              `2\ufe0f\u20e3 将机器人添加到群聊\n` +
              `3\ufe0f\u20e3 点击下方「重启」按钮上线`
            : isWeChat()
              ? `\u2705 #${proj} 已添加！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 用 #${proj} 发送任务即可开始\n` +
                `点击下方「重启」按钮上线`
              : `\u2705 @${u} 已添加到池中！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 下一步：\n` +
                `1\ufe0f\u20e3 将 @${u} 添加到本群\n` +
                `2\ufe0f\u20e3 在 @BotFather 中关闭 Group Privacy：\n` +
                `   /mybots \u2192 @${u} \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n` +
                `3\ufe0f\u20e3 点击下方「重启」按钮上线`,
        inviteSteps: (url: string) =>
          "\ud83d\udd17 邀请机器人进服务器：\n" +
          "1\ufe0f\u20e3 点击下方链接授权\n" +
          `${url}\n` +
          "2\ufe0f\u20e3 选择你的服务器 \u2192 授权\n" +
          "3\ufe0f\u20e3 确认后点击「立即重启」",
      }
    : {
        dmOnly: isWeChat()
          ? "\ud83d\udc4b Welcome! I'm your Claude Crew master bot.\n\n" +
            "Send setup to start the wizard\n" +
            "Send menu to open management \ud83d\ude80"
          : isFeishu()
            ? "\ud83d\udc4b Welcome! I'm your Claude Crew master bot.\n\n" +
              "Please @mention me in a group chat and send setup to start the wizard \ud83d\ude80"
            : isDiscord()
              ? "\ud83d\udc4b Welcome! I'm your Claude Crew master bot.\n\n" +
                "Please @mention me in a server channel and send setup to start the wizard \ud83d\ude80"
              : "\ud83d\udc4b Welcome! I'm your Claude Crew master bot.\n\n" +
                "Next steps:\n" +
                "1\ufe0f\u20e3 Create a private Telegram group\n" +
                "2\ufe0f\u20e3 Add me to the group\n" +
                "3\ufe0f\u20e3 Disable my Group Privacy in @BotFather:\n" +
                "   /mybots \u2192 select me \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n\n" +
                "I'll auto-start the setup wizard once I'm in the group \ud83d\ude80",
        needAdmin: isWeChat()
          ? "\ud83d\udc4b Connected! Send menu to get started."
          : "\ud83d\udc4b I've joined the group!\n\n\u26a0\ufe0f Please make me a group admin so I can pin the dashboard and manage messages.\n\nHow: Group settings \u2192 Administrators \u2192 Add me \u2192 Save",
        groupDetected: isWeChat()
          ? "\u2705 Ready! Send menu to manage projects."
          : "\u2705 Admin access granted!\n\nSet this group as your shared control group?\n\nOnce set, all project bots and management will happen here.",
        alreadySet: isWeChat()
          ? "\u2705 Already configured. Use config to manage."
          : "\u2705 This group is already configured as the shared group.\n\nUse config to manage settings.",
        otherGroup: isWeChat()
          ? "\u26a0\ufe0f Already configured in another chat."
          : "\u26a0\ufe0f A shared group is already configured in a different chat.\n\nUse config in that group to change it.",
        welcome: isWeChat()
          ? "\ud83d\udc4b Welcome to Claude Crew!\n\n" +
            "Send bots to add projects, use #projectname to send tasks."
          : "\ud83d\udc4b Welcome to Claude Crew Setup!\n\n" +
            "This will configure:\n" +
            "1\ufe0f\u20e3 Set this group as the shared control group\n" +
            "2\ufe0f\u20e3 Add your first project bot\n\n" +
            "Use this group as your shared control group?",
        yesUseGroup: isWeChat() ? "Yes, start" : "Yes, use this group",
        groupDone: (n: number) =>
          isWeChat()
            ? `\u2705 Configured! You have ${n} project(s).\n\n\ud83d\udd04 Restart to apply changes.`
            : `\u2705 Group configured!\n\nYou already have ${n} project bot(s). They'll now post updates here.\n\n\ud83d\udd04 Restart to apply changes.`,
        groupSet: isFeishu()
          ? "\u2705 Group set!\n\n" +
            "Now let's add your first project bot:\n\n" +
            "1\ufe0f\u20e3 Open Feishu Open Platform\n" +
            "   https://open.feishu.cn/app\n" +
            "2\ufe0f\u20e3 Create custom app \u2192 Add Bot capability\n" +
            "3\ufe0f\u20e3 Copy App ID and App Secret\n" +
            "4\ufe0f\u20e3 Send here in format: app_id:app_secret\n\n" +
            "Token format:\ncli_a5xxxxx:xxxxxxxxx"
          : isDiscord()
            ? "\u2705 Channel set!\n\n" +
              "Now let's add your first project bot:\n\n" +
              "1\ufe0f\u20e3 Open Discord Developer Portal\n" +
              "   https://discord.com/developers/applications\n" +
              "2\ufe0f\u20e3 New Application \u2192 enter name \u2192 Create\n" +
              "3\ufe0f\u20e3 Go to Bot \u2192 Reset Token \u2192 copy & send here\n" +
              "4\ufe0f\u20e3 Enable MESSAGE CONTENT INTENT\n\n" +
              "Token format:\nMTQ4ODU1.GRPIaY.cv3oBPEh..."
            : "\u2705 Group set!\n\n" +
              "Now let's add your first project bot:\n\n" +
              "1\ufe0f\u20e3 Open @BotFather\n" +
              "2\ufe0f\u20e3 Send /newbot\n" +
              "3\ufe0f\u20e3 Send the bot display name\n" +
              "4\ufe0f\u20e3 Send the bot username (must end with bot)\n" +
              "5\ufe0f\u20e3 Copy the HTTP API token and send it here\n\n" +
              "Token format:\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        welcomeGuide: isFeishu()
          ? "\u2705 Group set up!\n\n" +
            "\ud83c\udf89 Next steps:\n\n" +
            '\u2022 Tap "Add Bot" to create a dedicated bot for your project\n' +
            "\u2022 Then @mention the project bot in the group to run Claude Code tasks\n" +
            '\u2022 Send "menu" to the master bot to open management anytime\n\n' +
            "\ud83d\udca1 Create a bot on Feishu Open Platform first, then add its credentials here"
          : isDiscord()
            ? "\u2705 Channel set up!\n\n" +
              "\ud83c\udf89 Next steps:\n\n" +
              '\u2022 Tap "Add Bot" to create a dedicated bot for your project\n' +
              "\u2022 Then mention the project bot in the channel to run Claude Code tasks\n" +
              '\u2022 Send "menu" to the master bot to open management anytime\n\n' +
              "\ud83d\udca1 Create a bot in Developer Portal first, then add its token here"
            : "\u2705 Group set up!\n\n" +
              "\ud83c\udf89 Next steps:\n\n" +
              '\u2022 Tap "Add Bot" to create a dedicated bot for your project\n' +
              "\u2022 Then @mention the project bot in the group to run Claude Code tasks\n" +
              '\u2022 Send "menu" to the master bot to open management anytime\n\n' +
              "\ud83d\udca1 Create a bot in @BotFather first, then add its token here",
        invalidToken: isFeishu()
          ? "\u26a0\ufe0f That doesn't look like Feishu credentials.\n\nFormat: cli_a5xxxxx:app_secret\nCheck and try again:"
          : isDiscord()
            ? "\u26a0\ufe0f That doesn't look like a bot token.\n\nDiscord tokens are 3 base64 segments joined by dots.\nRegenerate in Developer Portal and try again:"
            : "\u26a0\ufe0f That doesn't look like a bot token.\n\n" +
              "Tokens look like: 123456789:ABCdefGHI...\n" +
              "Get one from @BotFather and try again:",
        duplicateToken:
          "\u26a0\ufe0f This bot is already in the pool.\nSend a different token:",
        validating: "\ud83d\udd0d Validating token...",
        invalidTokenApi: isFeishu()
          ? "\u274c Invalid credentials \u2014 Feishu API rejected them.\nCheck App ID and App Secret, then try again:"
          : isDiscord()
            ? "\u274c Invalid token \u2014 Discord rejected it.\nRegenerate in Developer Portal and try again:"
            : "\u274c Invalid token \u2014 Telegram rejected it.\nDouble-check with @BotFather and try again:",
        foundBot: (u: string) =>
          `\u2705 Found @${u}!\n\nWhat project name should I assign? (e.g. "my-api", "frontend")`,
        invalidProject:
          "\u26a0\ufe0f Project name should be 1-50 characters.\nTry again:",
        askPath: (_p: string) =>
          `Enter the absolute path to the project code:\n\n` +
          `Example: ${EXAMPLE_HOME}/projects/my-app\n` +
          `💡 Full disk path starting with /; will offer to create if missing`,
        invalidPath: (p: string) =>
          `\u26a0\ufe0f Directory not found: ${p}\nPlease enter an absolute path, e.g. ${EXAMPLE_HOME}/projects/xxx`,
        createDir: (p: string) => `\ud83d\udcc1 Create directory ${p}?`,
        created: (p: string) => `\u2705 Created: ${p}`,
        summary: "\ud83d\udcdd Setup Summary",
        saveConfig: "Save this configuration?",
        added: (u: string, proj: string, path: string) =>
          isFeishu()
            ? `\u2705 ${u} added to pool!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
              `\ud83d\udc49 Next steps:\n` +
              `1\ufe0f\u20e3 Publish the app version on Feishu Open Platform\n` +
              `2\ufe0f\u20e3 Add the bot to your group chat\n` +
              `3\ufe0f\u20e3 Click Restart below to bring it online`
            : isWeChat()
              ? `\u2705 #${proj} added!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 Use #${proj} to send tasks\n` +
                `Click Restart below to bring it online`
              : `\u2705 @${u} added to pool!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n` +
                `\ud83d\udc49 Next steps:\n` +
                `1\ufe0f\u20e3 Add @${u} to this group\n` +
                `2\ufe0f\u20e3 Disable Group Privacy in @BotFather:\n` +
                `   /mybots \u2192 @${u} \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n` +
                `3\ufe0f\u20e3 Click Restart below to bring it online`,
        inviteSteps: (url: string) =>
          "\ud83d\udd17 Invite bot to server:\n" +
          "1\ufe0f\u20e3 Click the link below to authorize\n" +
          `${url}\n` +
          "2\ufe0f\u20e3 Select your server \u2192 Authorize\n" +
          "3\ufe0f\u20e3 Then click Restart Now",
      };
}

// ── Bot-setup (misc) ──

export function setupMsg(lang: Lang) {
  return lang === "zh"
    ? {
        noPermission:
          "\u26d4 你没有使用此 bot 的权限\n\ud83d\udca1 请联系管理员添加使用权限",
        busy: "\u23f3 正在处理上一条消息...",
        noProject: (u: string) =>
          `\u26a0\ufe0f @${u} 未分配项目\n\ud83d\udca1 在 menu \u2192 机器人 中添加和分配项目`,
        masterOnly: (master: string) =>
          `\u2139\ufe0f 此命令需要发给主控机器人 @${master}\n\n在群里 @${master} 后跟命令即可。`,
        adminOnly: "\u26d4 仅管理员",
        expired: "\u23f0 已过期",
        authorized: "\u2705 已授权，正在重试...",
        skipped: "\u274c 已跳过",
        rateLimited:
          "\u23f3 请稍等几秒...\n\ud83d\udca1 冷却间隔可在 menu \u2192 配置 \u2192 rateLimitSeconds 中调整",
        queueFull: (active: number, max: number) =>
          `\u23f3 ${active}/${max} 个任务运行中，请稍候\n\ud83d\udca1 并发上限可在 menu \u2192 配置 \u2192 maxConcurrent 中调整`,
        noOutput: "(无输出)",
        taskDone: "\u2705 任务已执行（Claude 使用了工具但未产生文字回复）",
        approvalPrompt: (tools: string, min: number) =>
          `\ud83d\udd12 需要工具权限:\n${tools}\n\n批准后将重试\n\u23f0 超过 ${min} 分钟不操作将失效\n\ud83d\udca1 在 menu \u2192 配置 \u2192 permissionMode 中可切换为 allowAll 或 auto 免审批`,
        sessionTimedOut: (min: number) =>
          `\u23f0 任务超时（${min} 分钟限制）\n\ud83d\udca1 可在 menu \u2192 配置 \u2192 sessionTimeout 中调整时长`,
        circuitOpen: (bot: string, err: string, sec: number) =>
          `\u26a0\ufe0f @${bot} 连续失败已暂停（${sec}s 后恢复）\n原因: ${err}`,
        circuitTripped: (bot: string, count: number) =>
          `\ud83d\udea8 @${bot} 连续 ${count} 次失败，已熔断\n\ud83d\udca1 排查后 5 分钟内自动恢复`,
        authError: (bot: string) =>
          `\ud83d\udd11 @${bot} API 认证失败，已暂停\n\ud83d\udca1 请检查 ANTHROPIC_API_KEY`,
        truncationContinue: (attempt: number, max: number) =>
          `\u2702\ufe0f 输出被截断，自动续写 (${attempt}/${max})...`,
        adaptiveRateLimit: (sec: number) => `\u23f3 API 限速中，${sec}s 后恢复`,
        denialLimitReached:
          "\u26d4 审批多次被跳过\n\ud83d\udca1 建议 permissionMode 切换为 allowAll",
      }
    : {
        noPermission:
          "\u26d4 You don't have permission to use this bot\n\ud83d\udca1 Please contact an admin to get access",
        busy: "\u23f3 Processing previous message...",
        noProject: (u: string) =>
          `\u26a0\ufe0f @${u} No project assigned\n\ud83d\udca1 Add and assign in menu \u2192 Bots`,
        masterOnly: (master: string) =>
          `\u2139\ufe0f This command must be sent to the master bot @${master}\n\n@mention @${master} followed by the command.`,
        adminOnly: "\u26d4 Admin only",
        expired: "\u23f0 Expired",
        authorized: "\u2705 Authorized, retrying...",
        skipped: "\u274c Skipped",
        rateLimited:
          "\u23f3 Please wait a few seconds...\n\ud83d\udca1 Adjust cooldown in menu \u2192 Config \u2192 rateLimitSeconds",
        queueFull: (active: number, max: number) =>
          `\u23f3 ${active}/${max} tasks running, please wait\n\ud83d\udca1 Adjust limit in menu \u2192 Config \u2192 maxConcurrent`,
        noOutput: "(no output)",
        taskDone:
          "\u2705 Task executed (Claude used tools but produced no text response)",
        approvalPrompt: (tools: string, min: number) =>
          `\ud83d\udd12 Requires tool permissions:\n${tools}\n\nWill retry after approval\n\u23f0 Expires after ${min} min of inaction\n\ud83d\udca1 Switch to allowAll or auto in menu \u2192 Config \u2192 permissionMode to skip approval`,
        sessionTimedOut: (min: number) =>
          `\u23f0 Task timed out (${min} min limit)\n\ud83d\udca1 Adjust in menu \u2192 Config \u2192 sessionTimeout`,
        circuitOpen: (bot: string, err: string, sec: number) =>
          `\u26a0\ufe0f @${bot} paused after repeated failures (recovers in ${sec}s)\nLast error: ${err}`,
        circuitTripped: (bot: string, count: number) =>
          `\ud83d\udea8 @${bot} circuit breaker tripped after ${count} consecutive failures\n\ud83d\udca1 Auto-recovers in 5 minutes`,
        authError: (bot: string) =>
          `\ud83d\udd11 @${bot} API authentication failed, paused\n\ud83d\udca1 Check ANTHROPIC_API_KEY`,
        truncationContinue: (attempt: number, max: number) =>
          `\u2702\ufe0f Output truncated, auto-continuing (${attempt}/${max})...`,
        adaptiveRateLimit: (sec: number) =>
          `\u23f3 API rate-limited, resets in ${sec}s`,
        denialLimitReached:
          "\u26d4 Approval skipped too many times\n\ud83d\udca1 Consider switching permissionMode to allowAll",
      };
}

// ── Dashboard ──

export function dashMsg(lang: Lang) {
  return lang === "zh"
    ? {
        title: (time: string) => `\ud83d\udcca 项目看板 \u00b7 ${time}`,
        sessionStats: "\ud83d\udcc8 会话统计",
        noInvocations: "\ud83d\udcc8 会话统计: 暂无调用",
        invocations: "调用",
        duration: "时长",
        cost: "费用",
        rateReset: (str: string, type: string) =>
          `\u23f1 限速重置: ${str} (${type})`,
        master: (name: string) => `\ud83d\udc51 主控: @${name}`,
        cmds:
          "\ud83d\udcdd 文字命令（发给主控）:\n" +
          "  search <关键词> \u2014 跨项目搜索\n" +
          "  cron list / add / del \u2014 定时任务\n" +
          "  menu \u2014 呼出菜单",
      }
    : {
        title: (time: string) =>
          `\ud83d\udcca Project Dashboard \u00b7 ${time}`,
        sessionStats: "\ud83d\udcc8 Session Stats",
        noInvocations: "\ud83d\udcc8 Session Stats: No invocations yet",
        invocations: "Invocations",
        duration: "Duration",
        cost: "Cost",
        rateReset: (str: string, type: string) =>
          `\u23f1 Rate limit reset: ${str} (${type})`,
        master: (name: string) => `\ud83d\udc51 Master: @${name}`,
        cmds:
          "\ud83d\udcdd Text commands (send to master):\n" +
          "  search <keyword> \u2014 Search across projects\n" +
          "  cron list / add / del \u2014 Scheduled tasks\n" +
          "  menu \u2014 Show menu",
      };
}
