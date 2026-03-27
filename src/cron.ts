import { loadPool, loadCron, saveCron, getConfig } from "./config.js";
import { log } from "./logger.js";
import { botByUsername, daemon } from "./state.js";
import { invokeClaudeAndReply } from "./claude.js";

export async function checkCron(): Promise<void> {
  const jobs = loadCron();
  if (jobs.length === 0) return;

  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayStr = now.toISOString().split("T")[0];
  const updatedJobs = jobs.map((job) => {
    if (!job.enabled) return job;
    let shouldRun = false;

    if (job.schedule.includes(":")) {
      if (nowHHMM === job.schedule && job.lastRun?.split("T")[0] !== todayStr) {
        shouldRun = true;
      }
    } else if (job.schedule.startsWith("*/")) {
      const intervalMin = parseInt(job.schedule.slice(2), 10);
      if (!intervalMin) return job;
      const lastRunTime = job.lastRun ? new Date(job.lastRun).getTime() : 0;
      if (now.getTime() - lastRunTime >= intervalMin * 60 * 1000) {
        shouldRun = true;
      }
    }

    if (!shouldRun) return job;

    const managed = botByUsername.get(job.botUsername);
    if (!managed) {
      log(`CRON: ${job.id} — bot @${job.botUsername} not found`);
      return job;
    }
    if (managed.busy) {
      log(`CRON: ${job.id} — @${job.botUsername} busy, skip`);
      return job;
    }

    // Respect global concurrency limit
    const cfg = getConfig();
    if (daemon.activeInvocations >= cfg.maxConcurrent) {
      log(`CRON: ${job.id} — concurrency limit (${cfg.maxConcurrent}), skip`);
      return job;
    }

    const pool = loadPool();
    const chatId = pool.sharedGroupId;
    if (!chatId) return job;

    log(
      `CRON: ${job.id} — running "${job.prompt.slice(0, 50)}" on @${job.botUsername}`,
    );

    invokeClaudeAndReply(managed, chatId, job.prompt).catch((err) => {
      log(`CRON_FAIL: ${job.id} — ${err}`);
    });

    return { ...job, lastRun: now.toISOString() };
  });

  const changed = updatedJobs.some((j, i) => j !== jobs[i]);
  if (changed) saveCron(updatedJobs);
}
