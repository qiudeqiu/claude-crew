import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ManagedBot } from "./types.js";
import {
  loadPool,
  savePool,
  getBotModel,
  CONTEXT_BAR_LENGTH,
} from "./config.js";
import { log } from "./logger.js";
import { formatCost, splitMessage } from "./helpers.js";
import { sessionStats } from "./state.js";
import { getLang } from "./interactive/i18n.js";
import { invokeClaudeAndReply } from "./claude.js";

/**
 * Handle project bot slash commands.
 * Returns true if the command was handled, false otherwise.
 */
export async function handleBotSlashCommand(
  managed: ManagedBot,
  chatId: string,
  stripped: string,
): Promise<boolean> {
  const { config, platform: p } = managed;
  const lang = getLang();
  const zh = lang === "zh";

  // ── /new — reset session ──
  if (/^new$/i.test(stripped)) {
    managed.skipContinue = true;
    await p
      .sendMessage(
        chatId,
        zh
          ? "✅ 会话已重置，下次任务将开启全新上下文"
          : "✅ Session reset — next task will start with fresh context",
      )
      .catch(() => {});
    return true;
  }

  // ── /compact — compress context ──
  if (/^compact$/i.test(stripped)) {
    if (managed.busy) {
      await p
        .sendMessage(
          chatId,
          zh ? "⏳ 正在处理中，请稍后再试" : "⏳ Bot is busy, try again later",
        )
        .catch(() => {});
      return true;
    }
    void invokeClaudeAndReply(
      managed,
      chatId,
      zh
        ? "请压缩你的对话上下文，保留关键信息，删除不重要的细节。压缩后请回复确认，以'✅ 上下文已压缩：'开头，简要说明保留了什么、删除了什么"
        : "Please compact your conversation context — keep key information, remove unimportant details. After compacting, reply with a brief summary starting with '✅ Context compacted:'",
    );
    return true;
  }

  // ── /model [sonnet|opus|haiku] — switch model ──
  const ALLOWED_MODELS = /^(claude-[a-z0-9.-]+|sonnet|opus|haiku)$/i;
  const modelMatch = stripped.match(/^model(?:\s+(\S+))?$/i);
  if (modelMatch) {
    const newModel = modelMatch[1];
    if (!newModel) {
      const current = getBotModel(config) || (zh ? "(默认)" : "(default)");
      await p
        .sendMessage(
          chatId,
          zh ? `🤖 当前模型：${current}` : `🤖 Current model: ${current}`,
        )
        .catch(() => {});
      return true;
    }
    if (!ALLOWED_MODELS.test(newModel)) {
      await p
        .sendMessage(
          chatId,
          zh
            ? "⚠️ 无效模型。可选：sonnet, opus, haiku"
            : "⚠️ Invalid model. Options: sonnet, opus, haiku",
        )
        .catch(() => {});
      return true;
    }
    const pool = loadPool();
    const updatedBots = pool.bots.map((b) =>
      b.username === config.username ? { ...b, model: newModel } : b,
    );
    savePool({ ...pool, bots: updatedBots });
    log(`CMD: @${config.username} model → ${newModel} via chat`);
    await p
      .sendMessage(
        chatId,
        zh
          ? `✅ @${config.username} 模型已切换为 ${newModel}`
          : `✅ @${config.username} model switched to ${newModel}`,
      )
      .catch(() => {});
    return true;
  }

  // ── /effort [low|medium|high|max] — adjust thinking depth ──
  const effortMatch = stripped.match(/^effort(?:\s+(low|medium|high|max))?$/i);
  if (effortMatch) {
    const level = effortMatch[1];
    if (!level) {
      const current = managed.effort || "medium";
      await p
        .sendMessage(
          chatId,
          zh ? `🧠 当前思考深度：${current}` : `🧠 Current effort: ${current}`,
        )
        .catch(() => {});
      return true;
    }
    managed.effort = level.toLowerCase();
    log(`CMD: @${config.username} effort → ${managed.effort} via chat`);
    await p
      .sendMessage(
        chatId,
        zh
          ? `✅ 思考深度已调整为 ${managed.effort}`
          : `✅ Effort level set to ${managed.effort}`,
      )
      .catch(() => {});
    return true;
  }

  // ── /cost — view spend ──
  if (/^cost$/i.test(stripped)) {
    const botCost = formatCost(managed.lastCostUSD);
    const totalCost = formatCost(sessionStats.totalCostUSD);
    const totalInvokes = sessionStats.totalInvocations;
    const text = zh
      ? `💰 @${config.username} 费用统计\n━━━━━━━━━━━━━━━\n本 bot 累计: ${botCost}\n全局累计: ${totalCost} (${totalInvokes} 次调用)`
      : `💰 @${config.username} Cost\n━━━━━━━━━━━━━━━\nThis bot: ${botCost}\nAll bots: ${totalCost} (${totalInvokes} invocations)`;
    await p.sendMessage(chatId, text).catch(() => {});
    return true;
  }

  // ── /memory — view project memory ──
  if (/^memory$/i.test(stripped)) {
    const dir = config.assignedPath;
    if (!dir) {
      await p
        .sendMessage(
          chatId,
          zh ? "⚠️ 未分配项目目录" : "⚠️ No project directory assigned",
        )
        .catch(() => {});
      return true;
    }
    const claudeMd = join(dir, "CLAUDE.md");
    if (!existsSync(claudeMd)) {
      await p
        .sendMessage(
          chatId,
          zh
            ? "📝 该项目暂无 CLAUDE.md 记忆文件"
            : "📝 No CLAUDE.md memory file in this project",
        )
        .catch(() => {});
      return true;
    }
    const content = readFileSync(claudeMd, "utf8").trim();
    const header = zh
      ? `📝 @${config.username} 项目记忆 (CLAUDE.md)\n━━━━━━━━━━━━━━━\n\n`
      : `📝 @${config.username} Project memory (CLAUDE.md)\n━━━━━━━━━━━━━━━\n\n`;
    for (const chunk of splitMessage(header + content)) {
      await p.sendMessage(chatId, chunk).catch(() => {});
    }
    return true;
  }

  // ── /status — bot status ──
  if (/^status$/i.test(stripped)) {
    const project =
      config.assignedProject ?? (zh ? "(未分配)" : "(unassigned)");
    const path = config.assignedPath ?? (zh ? "(未分配)" : "(unassigned)");
    const model = getBotModel(config) || (zh ? "(默认)" : "(default)");
    const effort = managed.effort || "medium";
    const cost = formatCost(managed.lastCostUSD);
    const busyLabel = managed.busy
      ? zh
        ? "🔄 运行中"
        : "🔄 Running"
      : zh
        ? "💤 空闲"
        : "💤 Idle";

    let contextLine: string;
    if (managed.contextWindow > 0) {
      const pct = Math.round(
        (managed.contextUsed / managed.contextWindow) * 100,
      );
      const barLen = CONTEXT_BAR_LENGTH;
      const filled = Math.round((pct / 100) * barLen);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);
      contextLine = `Context: [${bar}] ${pct}%`;
    } else {
      contextLine = zh ? "Context: (暂无数据)" : "Context: (no data yet)";
    }

    const lastActive = managed.lastActivity
      ? (() => {
          const ago = Math.round((Date.now() - managed.lastActivity) / 60000);
          if (ago < 1) return zh ? "刚刚" : "just now";
          if (ago < 60) return zh ? `${ago} 分钟前` : `${ago}m ago`;
          return zh
            ? `${Math.floor(ago / 60)} 小时前`
            : `${Math.floor(ago / 60)}h ago`;
        })()
      : zh
        ? "(无)"
        : "(none)";

    const text = zh
      ? `🤖 @${config.username} 状态\n━━━━━━━━━━━━━━━\n项目: ${project}\n路径: ${path}\n模型: ${model}\n思考: ${effort}\n${contextLine}\n状态: ${busyLabel}\n上次活动: ${lastActive}\n累计花费: ${cost}`
      : `🤖 @${config.username} Status\n━━━━━━━━━━━━━━━\nProject: ${project}\nPath: ${path}\nModel: ${model}\nEffort: ${effort}\n${contextLine}\nState: ${busyLabel}\nLast active: ${lastActive}\nCost: ${cost}`;

    await p.sendMessage(chatId, text).catch(() => {});
    return true;
  }

  return false;
}
