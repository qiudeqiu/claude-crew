import { loadPool } from "./config.js";
import { log } from "./logger.js";
import { getSafeEnv } from "./helpers.js";
import { daemon, managedBots } from "./state.js";

export async function checkMemory(): Promise<void> {
  const pool = loadPool();
  const intervalMin = pool.memoryIntervalMinutes ?? 120;
  if (intervalMin <= 0) return; // disabled

  const chatId = pool.sharedGroupId;
  const now = Date.now();
  const intervalMs = intervalMin * 60 * 1000;
  const saving: string[] = [];

  for (const [, managed] of managedBots) {
    const { config } = managed;
    if (config.role === "master" || !config.assignedPath) continue;
    if (managed.busy) continue;

    // Skip if no activity since last memory save
    if (managed.lastActivity <= managed.lastMemorySave) continue;

    // Skip if not enough time passed since last save
    if (managed.lastMemorySave > 0 && now - managed.lastMemorySave < intervalMs)
      continue;

    // Skip if last activity was too long ago (stale)
    if (now - managed.lastActivity > intervalMs) continue;

    const project = config.assignedProject ?? "?";
    log(`MEMORY: saving for ${project}`);
    managed.lastMemorySave = now;
    saving.push(project);

    // Run claude -p to save memory (fire and forget)
    const proc = Bun.spawn({
      cmd: [
        "claude",
        "-p",
        "--continue",
        "--output-format",
        "text",
        "\u8bf7\u56de\u987e\u672c\u6b21\u4f1a\u8bdd\u7684\u5173\u952e\u5185\u5bb9\uff0c\u5c06\u91cd\u8981\u7684\u51b3\u7b56\u3001\u53d8\u66f4\u548c\u5f85\u529e\u4e8b\u9879\u4fdd\u5b58\u5230\u9879\u76ee\u7684 memory \u4e2d\uff08\u4f7f\u7528 auto memory \u673a\u5236\uff09\u3002\u53ea\u4fdd\u5b58\u6709\u4ef7\u503c\u7684\u4fe1\u606f\uff0c\u4e0d\u8981\u4fdd\u5b58\u7410\u788e\u7684\u7ec6\u8282\u3002\u5b8c\u6210\u540e\u7b80\u77ed\u8bf4\u660e\u4fdd\u5b58\u4e86\u4ec0\u4e48\u3002",
        "--allowedTools",
        "Bash,Edit,Write,Read,Glob,Grep",
      ],
      cwd: config.assignedPath,
      env: getSafeEnv(),
      stdout: "pipe",
      stderr: "ignore",
    });

    // Don't block — just log result when done
    new Response(proc.stdout)
      .text()
      .then((text) => {
        const summary = text.trim().slice(0, 200);
        log(`MEMORY: ${project} — ${summary || "(no output)"}`);
      })
      .catch(() => {});
  }

  // Notify via master bot
  if (saving.length > 0 && daemon.masterBot && chatId) {
    await daemon.masterBot.bot.api
      .sendMessage(chatId, `\ud83e\udde0 \u5b9a\u65f6\u8bb0\u5fc6: ${saving.join(", ")}`)
      .catch(() => {});
  }
}
