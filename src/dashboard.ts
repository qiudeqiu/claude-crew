import { readFileSync, writeFileSync } from "fs";
import {
  loadPool,
  getMasterName,
  DASHBOARD_FILE,
  CONTEXT_BAR_LENGTH,
} from "./config.js";
import { log } from "./logger.js";
import {
  gitInfo,
  formatTokens,
  formatCost,
  formatDuration,
  shortModelName,
} from "./helpers.js";
import { daemon, botByUsername, sessionStats } from "./state.js";
import { getLang, dashMsg } from "./interactive/i18n.js";
import { getCircuitInfo } from "./resilience.js";

export async function updateDashboard(): Promise<void> {
  if (!daemon.masterBot) {
    log("DASHBOARD: no masterBot");
    return;
  }
  const pool = loadPool();
  if (!pool.sharedGroupId) {
    log("DASHBOARD: no sharedGroupId");
    return;
  }
  log("DASHBOARD: updating...");

  const lang = getLang();
  const d = dashMsg(lang);

  const now = new Date();
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const timeStr = now.toLocaleString(locale, { hour12: false });

  const masterName = getMasterName(pool);

  let text = `${d.title(timeStr)}\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n`;

  for (const b of pool.bots) {
    if (b.role === "master") continue;
    if (!b.assignedPath) continue;

    const git = gitInfo(b.assignedPath);
    const botLabel = b.username ? `@${b.username}` : "?";
    const managed = botByUsername.get(b.username ?? "");
    const busyFlag = managed?.busy ? " \ud83d\udd04" : "";

    text += `\ud83d\udcc2 ${b.assignedProject}${busyFlag}\n`;
    if (git) {
      text += `   \ud83c\udf3f ${git.branch} \u00b7 ${git.lastCommitAge}\n`;
      text += `   \ud83d\udcac ${git.lastCommit.slice(0, 50)}\n`;
    }
    // Context usage bar
    if (managed && managed.contextWindow > 0) {
      const pct = Math.round(
        (managed.contextUsed / managed.contextWindow) * 100,
      );
      const barLen = CONTEXT_BAR_LENGTH;
      const filled = Math.round((pct / 100) * barLen);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);
      const modelShort = shortModelName(managed.lastModel);
      text += `   \ud83d\udcca [${modelShort}] ${bar} ${pct}%`;
      if (managed.lastCostUSD > 0)
        text += ` \u00b7 ${formatCost(managed.lastCostUSD)}`;
      text += `\n`;
    }
    // Circuit breaker status
    const circuit = getCircuitInfo(b.username ?? "");
    if (circuit && circuit.tripped) {
      text += `   \ud83d\udea8 ${lang === "zh" ? "已熔断" : "TRIPPED"}: ${circuit.lastError.slice(0, 40)}\n`;
    } else if (circuit && circuit.failures > 0) {
      text += `   \u26a0\ufe0f ${lang === "zh" ? "失败" : "failures"}: ${circuit.failures}\n`;
    }
    text += `   \ud83e\udd16 ${botLabel}\n\n`;
  }

  // Session stats
  if (sessionStats.totalInvocations > 0) {
    const tokenLines = Object.entries(sessionStats.tokensByModel)
      .map(([model, count]) => {
        const short = shortModelName(model);
        return `${short}: ${formatTokens(count)}`;
      })
      .join(" | ");

    text += `${d.sessionStats}\n`;
    text += `   ${d.invocations}: ${sessionStats.totalInvocations} | ${d.duration}: ${formatDuration(sessionStats.totalDurationMs)} | ${d.cost}: ${formatCost(sessionStats.totalCostUSD)}\n`;
    if (tokenLines) text += `   ${tokenLines}\n`;
  } else {
    text += `${d.noInvocations}\n`;
  }

  // Rate limit info
  if (daemon.rateLimitInfo && daemon.rateLimitInfo.resetsAt > 0) {
    const resetDate = new Date(daemon.rateLimitInfo.resetsAt * 1000);
    const diffMs = resetDate.getTime() - Date.now();
    const diffMin = Math.max(0, Math.round(diffMs / 60_000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    const resetStr = h > 0 ? `${h}h${m}m` : `${m}m`;
    text += `\n${d.rateReset(resetStr, daemon.rateLimitInfo.rateLimitType)}`;
  }

  // Master bot info + commands
  text += `\n\n${d.master(masterName)}\n${d.cmds}`;

  try {
    let dashMsgData: { messageId: number; chatId: string } | null = null;
    try {
      dashMsgData = JSON.parse(readFileSync(DASHBOARD_FILE, "utf8"));
    } catch {
      // File missing or corrupted — proceed as if no previous dashboard
    }

    const p = daemon.masterBot.platform;

    if (dashMsgData && dashMsgData.chatId === pool.sharedGroupId) {
      await p
        .deleteMessage(pool.sharedGroupId, String(dashMsgData.messageId))
        .catch(() => {});
    }

    const sent = await p.sendMessage(pool.sharedGroupId, text);
    writeFileSync(
      DASHBOARD_FILE,
      JSON.stringify({
        messageId: sent.id,
        chatId: pool.sharedGroupId,
      }),
      { mode: 0o600 },
    );
    await p.pinMessage(pool.sharedGroupId, sent.id).catch(() => {});
    log(`DASHBOARD: posted and pinned`);
  } catch (err) {
    log(`DASHBOARD_ERROR: ${err}`);
  }
}
