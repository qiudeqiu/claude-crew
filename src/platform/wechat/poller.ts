// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot long-polling loop.
 * Polls POST /ilink/bot/getupdates with cursor management.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { WECHAT_BASE_URL, buildHeaders, buildBaseInfo } from "./types.js";
import type { WeChatMessage, GetUpdatesResponse } from "./types.js";

const POLL_RETRY_DELAY_MS = 15_000;
const POLL_TIMEOUT_MS = 40_000;

/** Persist cursor to survive daemon restarts. */
function cursorPath(): string {
  const dir =
    process.env.TELEGRAM_POOL_DIR ??
    join(process.env.HOME ?? "/tmp", ".claude", "channels", "telegram");
  return join(dir, "wechat-cursor.json");
}

export class WeChatPoller {
  private botToken: string;
  private cursor = "";
  private running = false;
  private messageHandler?: (msg: WeChatMessage) => void;

  constructor(botToken: string) {
    this.botToken = botToken;
    // Restore cursor from disk
    try {
      if (existsSync(cursorPath())) {
        const data = JSON.parse(readFileSync(cursorPath(), "utf8"));
        this.cursor = data.get_updates_buf ?? "";
      }
    } catch {
      /* start fresh */
    }
  }

  /** Start the polling loop. Initializes cursor first. */
  start(onMessage: (msg: WeChatMessage) => void): void {
    this.messageHandler = onMessage;
    this.running = true;
    // Initialize cursor before starting message loop
    this.initCursor().then(() => this.poll());
  }

  /** Get initial cursor without processing messages (skip old messages). */
  private async initCursor(): Promise<void> {
    try {
      const resp = await fetch(`${WECHAT_BASE_URL}/ilink/bot/getupdates`, {
        method: "POST",
        headers: buildHeaders(this.botToken),
        body: JSON.stringify({
          get_updates_buf: "",
          base_info: buildBaseInfo(),
        }),
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
      if (resp.ok) {
        const data = (await resp.json()) as GetUpdatesResponse;
        if (data.get_updates_buf) {
          this.cursor = data.get_updates_buf;
        }
      }
    } catch {
      // Will retry in poll loop
    }
  }

  /** Stop the polling loop. */
  stop(): void {
    this.running = false;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);

        const resp = await fetch(`${WECHAT_BASE_URL}/ilink/bot/getupdates`, {
          method: "POST",
          headers: buildHeaders(this.botToken),
          body: JSON.stringify({
            get_updates_buf: this.cursor,
            base_info: buildBaseInfo(),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) {
          console.error(
            `[wechat] poll HTTP ${resp.status}, retry in ${POLL_RETRY_DELAY_MS / 1000}s`,
          );
          await this.delay(POLL_RETRY_DELAY_MS);
          continue;
        }

        const data = (await resp.json()) as GetUpdatesResponse;

        // API returns ret field only on error; successful responses have msgs + get_updates_buf
        if (data.ret && data.ret !== 0) {
          console.error(
            `[wechat] poll error ret=${data.ret}, retry in ${POLL_RETRY_DELAY_MS / 1000}s`,
          );
          await this.delay(POLL_RETRY_DELAY_MS);
          continue;
        }

        // Advance cursor + persist to disk
        if (data.get_updates_buf) {
          this.cursor = data.get_updates_buf;
          try {
            writeFileSync(
              cursorPath(),
              JSON.stringify({ get_updates_buf: this.cursor }),
              { mode: 0o600 },
            );
          } catch {
            /* non-fatal */
          }
        }

        // Dispatch messages
        if (data.msgs) {
          for (const msg of data.msgs) {
            try {
              this.messageHandler?.(msg);
            } catch {
              // swallow individual message errors
            }
          }
        }

        // No delay on success — immediately poll again
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Timeout — normal for long polling, just retry
          continue;
        }
        console.error(
          `[wechat] poll error: ${err}, retry in ${POLL_RETRY_DELAY_MS / 1000}s`,
        );
        await this.delay(POLL_RETRY_DELAY_MS);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
