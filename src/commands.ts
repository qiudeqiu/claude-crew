import { execSync, spawn } from "child_process";
import { join } from "path";
import { loadPool, loadCron, saveCron, STATE_DIR } from "./config.js";
import { log } from "./logger.js";
import { updateDashboard } from "./dashboard.js";

export function handleMasterCommand(
  stripped: string,
): string | null | undefined {
  if (/^help$/i.test(stripped)) {
    const pool = loadPool();
    const projectBots = pool.bots.filter((b) => b.role !== "master");
    return (
      `\ud83e\udd16 Bot \u6c60\u7ba1\u7406\u7cfb\u7edf v3\n` +
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
      `\ud83d\udcca ${projectBots.filter((b) => b.assignedProject).length} \u4e2a\u9879\u76ee\u5728\u7ebf\n\n` +
      `\ud83c\udfe0 \u4e3b\u63a7 Bot\n` +
      `  \u2022 help \u2014 \u672c\u5e2e\u52a9\n` +
      `  \u2022 status \u2014 \u5237\u65b0\u9879\u76ee\u770b\u677f\n` +
      `  \u2022 cron list / add / del\n` +
      `  \u2022 search \u5173\u952e\u8bcd \u2014 \u641c\u7d22\u6240\u6709\u9879\u76ee\n` +
      `  \u2022 restart \u2014 \u91cd\u542f daemon\n\n` +
      `\ud83d\udcc2 \u9879\u76ee Bot\n` +
      `  \u2022 @bot \u4f60\u7684\u9700\u6c42\n` +
      `  \u2022 \u56de\u590d bot \u6d88\u606f\u7ee7\u7eed\u5bf9\u8bdd\n\n` +
      `\ud83d\udfe2 \u9879\u76ee:\n` +
      projectBots
        .filter((b) => b.assignedProject)
        .map((b) => `  \u2022 ${b.assignedProject} (@${b.username ?? "?"})`)
        .join("\n")
    );
  }

  if (/^status$/i.test(stripped)) {
    void updateDashboard();
    return null;
  }

  if (/^restart$/i.test(stripped)) {
    log("RESTART: triggered via Telegram command");
    const daemonSh = join(STATE_DIR, "daemon.sh");
    setTimeout(() => {
      spawn(daemonSh, ["restart"], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }, 2000);
    return "\ud83d\udd04 Daemon \u6b63\u5728\u91cd\u542f...";
  }

  if (/^cron\s+list$/i.test(stripped)) {
    const jobs = loadCron();
    if (jobs.length === 0)
      return "\ud83d\udccb \u6682\u65e0\u5b9a\u65f6\u4efb\u52a1\n\n\u7528\u6cd5: cron add @bot HH:MM \u4efb\u52a1\u63cf\u8ff0";
    return (
      "\ud83d\udccb \u5b9a\u65f6\u4efb\u52a1\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n" +
      jobs
        .map((j) => {
          const status = j.enabled ? "\ud83d\udfe2" : "\u23f8";
          const last = j.lastRun ? j.lastRun.split("T")[0] : "\u4ece\u672a";
          return `${status} [${j.id}] @${j.botUsername} ${j.schedule}\n   ${j.prompt.slice(0, 60)}\n   \u4e0a\u6b21: ${last}`;
        })
        .join("\n\n")
    );
  }

  const cronAddMatch = stripped.match(
    /^cron\s+add\s+@(\w+)\s+(\d{1,2}:\d{2}|\*\/\d+)\s+(.+)$/i,
  );
  if (cronAddMatch) {
    const [, botUser, schedule, prompt] = cronAddMatch;
    const jobs = loadCron();
    const id = `job-${Date.now().toString(36)}`;
    jobs.push({
      id,
      botUsername: botUser!,
      schedule: schedule!,
      prompt: prompt!,
      enabled: true,
    });
    saveCron(jobs);
    return `\u2705 \u5b9a\u65f6\u4efb\u52a1\u5df2\u521b\u5efa\n  ID: ${id}\n  Bot: @${botUser}\n  \u65f6\u95f4: ${schedule}\n  \u4efb\u52a1: ${prompt}`;
  }

  const cronDelMatch = stripped.match(/^cron\s+del\s+(\S+)$/i);
  if (cronDelMatch) {
    const jobs = loadCron();
    const before = jobs.length;
    const filtered = jobs.filter((j) => j.id !== cronDelMatch[1]);
    if (filtered.length === before)
      return `\u26a0\ufe0f \u672a\u627e\u5230\u4efb\u52a1: ${cronDelMatch[1]}`;
    saveCron(filtered);
    return `\u2705 \u5df2\u5220\u9664\u4efb\u52a1: ${cronDelMatch[1]}`;
  }

  const searchMatch = stripped.match(/^search\s+(.+)$/i);
  if (searchMatch) {
    const keyword = searchMatch[1]!;
    // Sanitize: only allow word chars, spaces, dots, hyphens, underscores
    const safeKeyword = keyword.replace(/[^\w\s.\-]/g, "");
    if (!safeKeyword)
      return `\u26a0\ufe0f \u65e0\u6548\u7684\u641c\u7d22\u5173\u952e\u8bcd`;
    const pool = loadPool();
    const results: string[] = [];
    for (const b of pool.bots) {
      if (!b.assignedPath) continue;
      try {
        const out = execSync(
          `grep -rFl --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.json" --include="*.md" -- "${safeKeyword}" . 2>/dev/null | head -10`,
          { cwd: b.assignedPath, timeout: 10000 },
        )
          .toString()
          .trim();
        if (out) {
          results.push(
            `\ud83d\udcc2 ${b.assignedProject}:\n${out
              .split("\n")
              .map((f) => `  ${f}`)
              .join("\n")}`,
          );
        }
      } catch {}
    }
    if (results.length === 0)
      return `\ud83d\udd0d "${keyword}" \u2014 \u672a\u627e\u5230\u5339\u914d`;
    return `\ud83d\udd0d "${keyword}" \u641c\u7d22\u7ed3\u679c:\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n${results.join("\n\n")}`;
  }

  return undefined; // not a built-in command
}
