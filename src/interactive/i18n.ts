import { loadPool } from "../config.js";

export type Lang = "en" | "zh";

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
      }
    : {
        confirm: "Confirm",
        cancel: "Cancel",
        back: "Back",
        menu: "Menu",
        restartNow: "Restart Now",
        save: "Save",
        cancelled: "\u274c Cancelled.",
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
        refreshing: "\ud83d\udcca 正在刷新看板...",
        restarting: "\ud83d\udd04 正在重启...",
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
        refreshing: "\ud83d\udcca Refreshing dashboard...",
        restarting: "\ud83d\udd04 Restarting daemon...",
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
        addTitle:
          "\u2795 请按照以下流程进行机器人添加：\n\n" +
          "1\ufe0f\u20e3 点击打开 @BotFather\n" +
          "2\ufe0f\u20e3 发送 /newbot\n" +
          "3\ufe0f\u20e3 发送机器人名字（可中文）\n" +
          "4\ufe0f\u20e3 发送机器人 username（英文+数字，必须以 bot 结尾）\n" +
          "5\ufe0f\u20e3 创建完成后，看到一串 HTTP API，点击复制发送到此处\n\n" +
          "token 格式参考：\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        invalidToken:
          "\u26a0\ufe0f token 格式无效。\n格式如: 123456789:ABCdefGHI...\n请重试:",
        duplicateToken: "\u26a0\ufe0f 此机器人已在池中。",
        validating: "\ud83d\udd0d 验证 token...",
        invalidTokenApi: "\u274c 无效 token。请重试:",
        foundBot: (u: string) =>
          `\u2705 找到 @${u}！\n\n请输入项目名称 (如 "my-api"):`,
        invalidProject: "\u26a0\ufe0f 1-50 个字符。请重试:",
        askPath: (p: string) =>
          `\ud83d\udcc2 项目: ${p}\n\n请输入项目目录的绝对路径:`,
        invalidPath: (p: string) => `\u26a0\ufe0f 目录未找到: ${p}\n请重试:`,
        summaryTitle: "\ud83d\udcdd 添加机器人摘要",
        bot: "机器人",
        added: (u: string, proj: string, path: string) =>
          `\u2705 @${u} 已添加！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n重启后上线。`,
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
        addTitle:
          "\u2795 Follow these steps to add a bot:\n\n" +
          "1\ufe0f\u20e3 Open @BotFather\n" +
          "2\ufe0f\u20e3 Send /newbot\n" +
          "3\ufe0f\u20e3 Send the bot display name\n" +
          "4\ufe0f\u20e3 Send the bot username (must end with bot)\n" +
          "5\ufe0f\u20e3 Copy the HTTP API token and send it here\n\n" +
          "Token format:\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        invalidToken:
          "\u26a0\ufe0f Invalid token format.\nTokens look like: 123456789:ABCdefGHI...\nTry again:",
        duplicateToken: "\u26a0\ufe0f This bot is already in the pool.",
        validating: "\ud83d\udd0d Validating token...",
        invalidTokenApi: "\u274c Invalid token. Try again:",
        foundBot: (u: string) =>
          `\u2705 Found @${u}!\n\nWhat project name? (e.g. "my-api")`,
        invalidProject: "\u26a0\ufe0f 1-50 characters. Try again:",
        askPath: (p: string) =>
          `\ud83d\udcc2 Project: ${p}\n\nAbsolute path to project directory:`,
        invalidPath: (p: string) =>
          `\u26a0\ufe0f Directory not found: ${p}\nTry again:`,
        summaryTitle: "\ud83d\udcdd Add Bot Summary",
        bot: "Bot",
        added: (u: string, proj: string, path: string) =>
          `\u2705 @${u} added!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\nRestart to bring it online.`,
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
        memoryInterval: "memoryInterval",
        whisperLanguage: "whisperLanguage",
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
        memoryInterval: "memoryInterval",
        whisperLanguage: "whisperLanguage",
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
        mc: "所有机器人的最大并行 Claude 调用数。遇到限速时调低此值。",
        rl: "同一机器人两次调用之间的最小冷却秒数，防止刷屏。",
        st: "单次 Claude 调用的最大时长（分钟），超时将被终止。",
        di: "置顶看板消息的自动刷新间隔（分钟）。",
        mi: "活跃项目自动保存对话记忆的间隔（分钟）。0 = 禁用。",
        wl: "语音转写的语言提示（Whisper）。空 = 自动检测。",
        ap: "此机器人管理的项目显示名称",
        ph: "项目目录在磁盘上的绝对路径",
      }
    : {
        pm: "How write operations (file edits, shell commands) are authorized",
        al: "What the bot is allowed to do in the project",
        me: "Allow the master bot to run Claude tasks (not just admin commands)",
        mc: "Maximum parallel Claude invocations across all bots. Lower this if you hit rate limits.",
        rl: "Minimum cooldown between invocations for the same bot. Prevents accidental spam.",
        st: "Maximum duration for a single Claude invocation before it's killed.",
        di: "How often the pinned dashboard message auto-refreshes.",
        mi: "How often active projects auto-save conversation memory. 0 = disabled.",
        wl: "Language hint for voice transcription (Whisper). Empty = auto-detect.",
        ap: "Display name for the project this bot manages",
        ph: "Absolute path to the project directory on disk",
      };
}

// ── Config option descriptions ──

export function optDesc(lang: Lang) {
  return lang === "zh"
    ? {
        pm_allowAll: "预授权所有工具 — 无提示，最快执行",
        pm_approve:
          "首次只读运行；需要写入时，发送 Telegram 按钮请求管理员批准",
        pm_auto: "Claude Code 后台安全分类器自动批准安全操作，阻止危险操作",
        pm_inherit: "使用全局 permissionMode 设置",
        al_readWrite: "完全访问 — 读文件、写文件、运行命令",
        al_readOnly: "仅读取/搜索 — 不可编辑文件，不可执行写命令",
        al_inherit: "使用全局 accessLevel 设置",
        me_true: "主控机器人可以直接执行 Claude 任务",
        me_false: "主控机器人仅处理管理命令（help、status 等）",
      }
    : {
        pm_allowAll:
          "Pre-authorize all tools \u2014 no prompts, fastest execution",
        pm_approve:
          "First run read-only; if writes needed, sends a Telegram button for admin approval",
        pm_auto:
          "Claude Code\u2019s background safety classifier auto-approves safe ops, blocks dangerous ones",
        pm_inherit: "Use the global permissionMode setting",
        al_readWrite:
          "Full access \u2014 read files, write files, run commands",
        al_readOnly: "Read/search only \u2014 no file edits, no write commands",
        al_inherit: "Use the global accessLevel setting",
        me_true: "Master bot can execute Claude tasks when messaged directly",
        me_false: "Master bot only handles admin commands (help, status, etc.)",
      };
}

// ── Config field hints ──

export function fieldHint(lang: Lang) {
  return lang === "zh"
    ? {
        mc: "推荐: Pro 计划 2-3, Max 计划 3-5",
        rl: "0 = 无冷却, 5 = 推荐默认值",
        st: "10 = 默认值, 长任务可调高",
        di: "30 = 默认值。值越小 API 调用越频繁",
        mi: "120 = 默认值。保存上下文以便 Claude 记住过去对话",
        wl: '如 "en"、"zh"、"ja"、"ko"，或留空自动检测',
        ap: '如 "my-api"、"frontend"',
        ph: "如 /home/user/projects/my-api",
      }
    : {
        mc: "Recommended: 2-3 for Pro plan, 3-5 for Max plan",
        rl: "0 = no cooldown, 5 = recommended default",
        st: "10 = default, increase for long-running tasks",
        di: "30 = default. Lower values increase API calls",
        mi: "120 = default. Saves context so Claude remembers past conversations",
        wl: 'e.g. "en", "zh", "ja", "ko", or empty for auto',
        ap: 'e.g. "my-api", "frontend"',
        ph: "e.g. /home/user/projects/my-api",
      };
}

// ── User Management ──

export function usersMsg(lang: Lang) {
  return lang === "zh"
    ? {
        title: "\ud83d\udc65 用户管理",
        adminsTitle: "\ud83d\udc51 管理员（全局权限）:",
        perBotTitle: "\ud83e\udd16 机器人用户:",
        userCount: (n: number) => (n > 0 ? `${n} 个用户` : "无"),
        addAdmin: "\u2795 添加管理员",
        botUsers: (u: string) => `\ud83d\udc65 @${u} 用户`,
        addAdminPrompt:
          "\ud83d\udc51 添加管理员\n\n发送 Telegram 用户 ID（数字）。\n\n提示: 可通过 @userinfobot 获取 ID",
        cantRemoveLast:
          "\u26a0\ufe0f 不能删除最后一个管理员。\n\n请先添加其他管理员。",
        adminRemoved: (id: string) => `\u2705 管理员 ${id} 已移除。`,
        botUsersTitle: (u: string) => `\ud83d\udc65 @${u} 用户`,
        noUsers: "  (无用户 — 管理员始终有权限)",
        addUser: "\u2795 添加用户",
        addUserPrompt: (u: string) =>
          `\ud83d\udc65 添加用户到 @${u}\n\n发送 Telegram 用户 ID（数字）:`,
        invalidId: "\u26a0\ufe0f 用户 ID 必须是数字（如 123456789）。\n请重试:",
        alreadyAdmin: (id: string) => `\u26a0\ufe0f ${id} 已是管理员。`,
        adminAdded: (id: string) => `\u2705 管理员已添加: ${id}`,
        userMgmt: "用户管理",
        alreadyUser: (id: string, u: string) =>
          `\u26a0\ufe0f ${id} 已有 @${u} 的权限。`,
        userAdded: (id: string, u: string) =>
          `\u2705 用户 ${id} 已添加到 @${u}`,
      }
    : {
        title: "\ud83d\udc65 User Management",
        adminsTitle: "\ud83d\udc51 Admins (global access):",
        perBotTitle: "\ud83e\udd16 Per-bot users:",
        userCount: (n: number) => (n > 0 ? `${n} user(s)` : "none"),
        addAdmin: "\u2795 Add Admin",
        botUsers: (u: string) => `\ud83d\udc65 @${u} users`,
        addAdminPrompt:
          "\ud83d\udc51 Add Admin\n\nSend the Telegram user ID (numeric).\n\nTip: users can find their ID with @userinfobot",
        cantRemoveLast:
          "\u26a0\ufe0f Can't remove the last admin.\n\nAdd another admin first.",
        adminRemoved: (id: string) => `\u2705 Admin ${id} removed.`,
        botUsersTitle: (u: string) => `\ud83d\udc65 @${u} Users`,
        noUsers: "  (no users \u2014 admins always have access)",
        addUser: "\u2795 Add User",
        addUserPrompt: (u: string) =>
          `\ud83d\udc65 Add user to @${u}\n\nSend the Telegram user ID (numeric):`,
        invalidId:
          "\u26a0\ufe0f User ID must be numeric (e.g. 123456789).\nTry again:",
        alreadyAdmin: (id: string) => `\u26a0\ufe0f ${id} is already an admin.`,
        adminAdded: (id: string) => `\u2705 Admin added: ${id}`,
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
        dmOnly:
          "\ud83d\udc4b 欢迎！我是你的 Claude Crew 主控机器人。\n\n" +
          "下一步：\n" +
          "1\ufe0f\u20e3 创建一个 Telegram 私密群组\n" +
          "2\ufe0f\u20e3 把我拉进群组\n" +
          "3\ufe0f\u20e3 在 @BotFather 中关闭我的 Group Privacy：\n" +
          "   /mybots \u2192 选择我 \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n\n" +
          "拉进群后我会自动发起设置向导 \ud83d\ude80",
        groupDetected:
          "\ud83d\udc4b 检测到新群组！\n\n是否将此群组设为共享控制群组？\n\n设置后，所有项目机器人和管理操作都将在此群组中进行。",
        alreadySet: "\u2705 此群组已配置为共享群组。\n\n使用 config 管理设置。",
        otherGroup:
          "\u26a0\ufe0f 共享群组已在其他聊天中配置。\n\n请在该群组中使用 config 修改。",
        welcome:
          "\ud83d\udc4b 欢迎使用 Claude Crew 设置!\n\n" +
          "将配置:\n" +
          "1\ufe0f\u20e3 设置此群组为共享控制群组\n" +
          "2\ufe0f\u20e3 添加你的第一个项目机器人\n\n" +
          "使用此群组作为共享控制群组?",
        yesUseGroup: "是，使用此群组",
        groupDone: (n: number) =>
          `\u2705 群组已配置！\n\n你已有 ${n} 个项目机器人。\n它们将在此群组发布更新。\n\n\ud83d\udd04 重启以应用更改。`,
        groupSet:
          "\u2705 群组已设置！\n\n" +
          "现在添加你的第一个项目机器人：\n\n" +
          "1\ufe0f\u20e3 点击打开 @BotFather\n" +
          "2\ufe0f\u20e3 发送 /newbot\n" +
          "3\ufe0f\u20e3 发送机器人名字（可中文）\n" +
          "4\ufe0f\u20e3 发送机器人 username（英文+数字，必须以 bot 结尾）\n" +
          "5\ufe0f\u20e3 创建完成后，看到一串 HTTP API，点击复制发送到此处\n\n" +
          "token 格式参考：\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        invalidToken:
          "\u26a0\ufe0f 这不像一个 bot token。\n\n" +
          "token 格式如: 123456789:ABCdefGHI...\n" +
          "从 @BotFather 获取后重试:",
        duplicateToken: "\u26a0\ufe0f 此机器人已在池中。\n请发送其他 token:",
        validating: "\ud83d\udd0d 验证 token...",
        invalidTokenApi:
          "\u274c 无效 token — Telegram 拒绝了。\n请检查 @BotFather 后重试:",
        foundBot: (u: string) =>
          `\u2705 找到 @${u}！\n\n请输入项目名称 (如 "my-api"、"frontend"):`,
        invalidProject: "\u26a0\ufe0f 项目名称应为 1-50 个字符。\n请重试:",
        askPath: (p: string) =>
          `\ud83d\udcc2 项目: ${p}\n\n请输入项目目录的绝对路径:\n(如 /home/user/projects/my-api)`,
        invalidPath: (p: string) =>
          `\u26a0\ufe0f 目录未找到: ${p}\n请输入有效的绝对路径:`,
        summary: "\ud83d\udcdd 设置摘要",
        saveConfig: "保存此配置?",
        added: (u: string, proj: string, path: string) =>
          `\u2705 @${u} 已添加到池中！\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\n重启以上线。`,
      }
    : {
        dmOnly:
          "\ud83d\udc4b Welcome! I'm your Claude Crew master bot.\n\n" +
          "Next steps:\n" +
          "1\ufe0f\u20e3 Create a private Telegram group\n" +
          "2\ufe0f\u20e3 Add me to the group\n" +
          "3\ufe0f\u20e3 Disable my Group Privacy in @BotFather:\n" +
          "   /mybots \u2192 select me \u2192 Bot Settings \u2192 Group Privacy \u2192 Turn off\n\n" +
          "I'll auto-start the setup wizard once I'm in the group \ud83d\ude80",
        groupDetected:
          "\ud83d\udc4b New group detected!\n\nSet this group as your shared control group?\n\nOnce set, all project bots and management will happen here.",
        alreadySet:
          "\u2705 This group is already configured as the shared group.\n\nUse config to manage settings.",
        otherGroup:
          "\u26a0\ufe0f A shared group is already configured in a different chat.\n\nUse config in that group to change it.",
        welcome:
          "\ud83d\udc4b Welcome to Claude Crew Setup!\n\n" +
          "This will configure:\n" +
          "1\ufe0f\u20e3 Set this group as the shared control group\n" +
          "2\ufe0f\u20e3 Add your first project bot\n\n" +
          "Use this group as your shared control group?",
        yesUseGroup: "Yes, use this group",
        groupDone: (n: number) =>
          `\u2705 Group configured!\n\nYou already have ${n} project bot(s). They'll now post updates here.\n\n\ud83d\udd04 Restart to apply changes.`,
        groupSet:
          "\u2705 Group set!\n\n" +
          "Now let's add your first project bot:\n\n" +
          "1\ufe0f\u20e3 Open @BotFather\n" +
          "2\ufe0f\u20e3 Send /newbot\n" +
          "3\ufe0f\u20e3 Send the bot display name\n" +
          "4\ufe0f\u20e3 Send the bot username (must end with bot)\n" +
          "5\ufe0f\u20e3 Copy the HTTP API token and send it here\n\n" +
          "Token format:\n8203239227:AAGiYi6u9g0iUHH7792QHo5-xxxxxxx",
        invalidToken:
          "\u26a0\ufe0f That doesn't look like a bot token.\n\n" +
          "Tokens look like: 123456789:ABCdefGHI...\n" +
          "Get one from @BotFather and try again:",
        duplicateToken:
          "\u26a0\ufe0f This bot is already in the pool.\nSend a different token:",
        validating: "\ud83d\udd0d Validating token...",
        invalidTokenApi:
          "\u274c Invalid token \u2014 Telegram rejected it.\nDouble-check with @BotFather and try again:",
        foundBot: (u: string) =>
          `\u2705 Found @${u}!\n\nWhat project name should I assign? (e.g. "my-api", "frontend")`,
        invalidProject:
          "\u26a0\ufe0f Project name should be 1-50 characters.\nTry again:",
        askPath: (p: string) =>
          `\ud83d\udcc2 Project: ${p}\n\nWhat's the absolute path to the project directory?\n(e.g. /home/user/projects/my-api)`,
        invalidPath: (p: string) =>
          `\u26a0\ufe0f Directory not found: ${p}\nSend a valid absolute path:`,
        summary: "\ud83d\udcdd Setup Summary",
        saveConfig: "Save this configuration?",
        added: (u: string, proj: string, path: string) =>
          `\u2705 @${u} added to pool!\n\n\ud83d\udcc2 ${proj} \u2192 ${path}\n\nRestart the daemon to bring the bot online.`,
      };
}

// ── Bot-setup (misc) ──

export function setupMsg(lang: Lang) {
  return lang === "zh"
    ? {
        busy: "\u23f3 正在处理上一条消息...",
        noProject: (u: string) => `\u26a0\ufe0f @${u} 未分配项目`,
        masterOnly: (master: string) =>
          `\u2139\ufe0f 此命令需要发给主控机器人 @${master}\n\n在群里 @${master} 后跟命令即可。`,
      }
    : {
        busy: "\u23f3 Processing previous message...",
        noProject: (u: string) => `\u26a0\ufe0f @${u} No project assigned`,
        masterOnly: (master: string) =>
          `\u2139\ufe0f This command must be sent to the master bot @${master}\n\n@mention @${master} followed by the command.`,
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
