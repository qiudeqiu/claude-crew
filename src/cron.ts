import { loadPool, loadCron, saveCron } from "./config.js";
import { log } from "./logger.js";
import { botByUsername } from "./state.js";
import { invokeClaudeAndReply } from "./claude.js";

export async function checkCron(): Promise<void> {
  const jobs = loadCron();
  if (jobs.length === 0) return;

  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayStr = now.toISOString().split("T")[0];
  let changed = false;

  for (const job of jobs) {
    if (!job.enabled) continue;
    let shouldRun = false;

    if (job.schedule.includes(":")) {
      if (
        nowHHMM === job.schedule &&
        job.lastRun?.split("T")[0] !== todayStr
      ) {
        shouldRun = true;
      }
    } else if (job.schedule.startsWith("*/")) {
      const intervalMin = parseInt(job.schedule.slice(2), 10);
      if (!intervalMin) continue;
      const lastRunTime = job.lastRun ? new Date(job.lastRun).getTime() : 0;
      if (now.getTime() - lastRunTime >= intervalMin * 60 * 1000) {
        shouldRun = true;
      }
    }

    if (!shouldRun) continue;

    const managed = botByUsername.get(job.botUsername);
    if (!managed) {
      log(`CRON: ${job.id} — bot @${job.botUsername} not found`);
      continue;
    }
    if (managed.busy) {
      log(`CRON: ${job.id} — @${job.botUsername} busy, skip`);
      continue;
    }

    const pool = loadPool();
    const chatId = pool.sharedGroupId;
    if (!chatId) continue;

    log(
      `CRON: ${job.id} — running "${job.prompt.slice(0, 50)}" on @${job.botUsername}`,
    );

    job.lastRun = now.toISOString();
    changed = true;

    invokeClaudeAndReply(managed, chatId, job.prompt).catch((err) => {
      log(`CRON_FAIL: ${job.id} — ${err}`);
    });
  }

  if (changed) saveCron(jobs);
}
