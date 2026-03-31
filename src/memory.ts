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
        "Review the key content of this session and save important decisions, changes, and pending items to the project's memory (using the auto memory mechanism). Only save valuable information, not trivial details. When done, briefly describe what was saved.",
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
    await daemon.masterBot.platform
      .sendMessage(chatId, `\ud83e\udde0 Periodic memory: ${saving.join(", ")}`)
      .catch(() => {});
  }
}
