// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot long-polling loop.
 * Polls POST /ilink/bot/getupdates with cursor management.
 */

import { WECHAT_BASE_URL, buildHeaders } from "./types.js";
import type { WeChatMessage, GetUpdatesResponse } from "./types.js";

const POLL_RETRY_DELAY_MS = 15_000;
const POLL_TIMEOUT_MS = 40_000; // slightly above server's 35s longpolling timeout

export class WeChatPoller {
  private botToken: string;
  private cursor = "";
  private running = false;
  private messageHandler?: (msg: WeChatMessage) => void;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /** Start the polling loop. */
  start(onMessage: (msg: WeChatMessage) => void): void {
    this.messageHandler = onMessage;
    this.running = true;
    this.poll();
  }

  /** Stop the polling loop. */
  stop(): void {
    this.running = false;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          POLL_TIMEOUT_MS,
        );

        const resp = await fetch(
          `${WECHAT_BASE_URL}/ilink/bot/getupdates`,
          {
            method: "POST",
            headers: buildHeaders(this.botToken),
            body: JSON.stringify({
              get_updates_buf: this.cursor,
              base_info: { channel_version: "1.0.2" },
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeout);

        if (!resp.ok) {
          console.error(
            `[wechat] poll HTTP ${resp.status}, retry in ${POLL_RETRY_DELAY_MS / 1000}s`,
          );
          await this.delay(POLL_RETRY_DELAY_MS);
          continue;
        }

        const data = (await resp.json()) as GetUpdatesResponse;

        if (data.ret !== 0) {
          console.error(
            `[wechat] poll error ret=${data.ret}, retry in ${POLL_RETRY_DELAY_MS / 1000}s`,
          );
          await this.delay(POLL_RETRY_DELAY_MS);
          continue;
        }

        // Advance cursor
        if (data.get_updates_buf) {
          this.cursor = data.get_updates_buf;
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
