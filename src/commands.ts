// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import { execFileSync, spawn } from "child_process";
import { join } from "path";
import {
  loadPool,
  loadCron,
  saveCron,
  getMasterName,
  hasPermission,
  STATE_DIR,
} from "./config.js";
import { log } from "./logger.js";
import { updateDashboard } from "./dashboard.js";
import { getLang, menuMsg } from "./interactive/i18n.js";

const NO_PERM = "\u26d4";

export function handleMasterCommand(
  stripped: string,
  userId: string,
): string | null | undefined {
  if (/^status$/i.test(stripped)) {
    void updateDashboard();
    return null;
  }

  if (/^restart$/i.test(stripped)) {
    if (!hasPermission(userId, "restart")) return NO_PERM;
    log("RESTART: triggered via Telegram command");
    const daemonSh = join(STATE_DIR, "daemon.sh");
    setTimeout(() => {
      spawn(daemonSh, ["restart"], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }, 2000);
    return "\ud83d\udd04 Daemon restarting...";
  }

  if (/^cron\s/i.test(stripped) && !hasPermission(userId, "cron")) {
    return NO_PERM;
  }

  if (/^cron\s+list$/i.test(stripped)) {
    const lang = getLang();
    const m = menuMsg(lang);
    const pool = loadPool();
    const masterName = getMasterName(pool);
    const jobs = loadCron();
    if (jobs.length === 0) return m.noTasks(masterName);
    return (
      `${m.tasksTitle}\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
      jobs
        .map((j) => {
          const status = j.enabled ? "\ud83d\udfe2" : "\u23f8";
          const last = j.lastRun ? j.lastRun.split("T")[0] : "never";
          return `${status} [${j.id}] @${j.botUsername} ${j.schedule}\n   ${j.prompt.slice(0, 60)}\n   ${m.last}: ${last}`;
        })
        .join("\n\n")
    );
  }

  // Support: cron add @bot HH:MM task  /  cron add HH:MM task @bot  /  cron add #tag HH:MM task (WeChat)
  const cronAddOld = stripped.match(
    /^cron\s+add\s+@([\w-]+)\s+(\d{1,2}:\d{2}|\*\/\d+)\s+(.+)$/i,
  );
  const cronAddNew = stripped.match(
    /^cron\s+add\s+(\d{1,2}:\d{2}|\*\/\d+)\s+(.+)\s+@([\w-]+)$/i,
  );
  const cronAddTag = stripped.match(
    /^cron\s+add\s+#([\w-]+)\s+(\d{1,2}:\d{2}|\*\/\d+)\s+(.+)$/i,
  );
  const cronAddMatch = cronAddOld
    ? { botUser: cronAddOld[1], schedule: cronAddOld[2], prompt: cronAddOld[3], byTag: false }
    : cronAddNew
      ? { botUser: cronAddNew[3], schedule: cronAddNew[1], prompt: cronAddNew[2], byTag: false }
      : cronAddTag
        ? { botUser: cronAddTag[1], schedule: cronAddTag[2], prompt: cronAddTag[3], byTag: true }
        : null;
  if (cronAddMatch) {
    const { botUser, schedule, prompt, byTag } = cronAddMatch;

    // Resolve: accept @username, project name, or #tag (WeChat)
    const pool = loadPool();
    let resolvedUsername = botUser!;
    const directMatch = pool.bots.find(
      (b) => b.username?.toLowerCase() === botUser!.toLowerCase(),
    );
    if (!directMatch) {
      const byProject = pool.bots.find(
        (b) => b.assignedProject?.toLowerCase() === botUser!.toLowerCase(),
      );
      if (byProject?.username) {
        resolvedUsername = byProject.username;
      } else {
        const prefix = byTag ? "#" : "@";
        return `\u26a0\ufe0f Bot not found: ${prefix}${botUser}\nUse the bot username, project name, or #tag.`;
      }
    }

    const jobs = loadCron();
    const id = `job-${Date.now().toString(36)}`;
    jobs.push({
      id,
      botUsername: resolvedUsername,
      schedule: schedule!,
      prompt: prompt!,
      enabled: true,
    });
    saveCron(jobs);
    return `\u2705 Scheduled task created\n  ID: ${id}\n  Bot: @${resolvedUsername}\n  Schedule: ${schedule}\n  Task: ${prompt}`;
  }

  const cronDelMatch = stripped.match(/^cron\s+del\s+(\S+)$/i);
  if (cronDelMatch) {
    const jobs = loadCron();
    const before = jobs.length;
    const filtered = jobs.filter((j) => j.id !== cronDelMatch[1]);
    if (filtered.length === before)
      return `\u26a0\ufe0f Task not found: ${cronDelMatch[1]}`;
    saveCron(filtered);
    return `\u2705 Task deleted: ${cronDelMatch[1]}`;
  }

  const searchMatch = stripped.match(/^search\s+(.+)$/i);
  if (searchMatch) {
    const keyword = searchMatch[1]!;
    // Sanitize: only allow word chars, spaces, dots, hyphens, underscores
    const safeKeyword = keyword.replace(/[^\w\s.\-]/g, "");
    if (!safeKeyword) return `\u26a0\ufe0f Invalid search keyword`;
    const pool = loadPool();
    const results: string[] = [];
    for (const b of pool.bots) {
      if (!b.assignedPath) continue;
      try {
        const out = execFileSync(
          "grep",
          [
            "-rFl",
            "--include=*.ts",
            "--include=*.js",
            "--include=*.py",
            "--include=*.go",
            "--include=*.json",
            "--include=*.md",
            "--",
            safeKeyword,
            ".",
          ],
          { cwd: b.assignedPath, timeout: 10000, maxBuffer: 1024 * 64 },
        )
          .toString()
          .trim()
          .split("\n")
          .slice(0, 10)
          .join("\n");
        if (out) {
          results.push(
            `\ud83d\udcc2 ${b.assignedProject}:\n${out
              .split("\n")
              .map((f) => `  ${f}`)
              .join("\n")}`,
          );
        }
      } catch {
        // grep returns non-zero when no matches — expected
      }
    }
    if (results.length === 0)
      return `\ud83d\udd0d "${safeKeyword}" \u2014 No matches found`;
    return `\ud83d\udd0d "${safeKeyword}" Search results:\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n${results.join("\n\n")}`;
  }

  return undefined; // not a built-in command
}
