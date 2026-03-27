import { appendFileSync, readFileSync, writeFileSync, statSync } from "fs";
import {
  LOG_FILE,
  LOG_MAX_BYTES,
  LOG_RETAIN_BYTES,
  LOG_ROTATE_INTERVAL,
} from "./config.js";

let logWriteCount = 0;

export function log(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    appendFileSync(LOG_FILE, line, { mode: 0o600 });
    if (++logWriteCount >= LOG_ROTATE_INTERVAL) {
      logWriteCount = 0;
      try {
        if (statSync(LOG_FILE).size > LOG_MAX_BYTES) {
          const tail = readFileSync(LOG_FILE, "utf8").slice(-LOG_RETAIN_BYTES);
          writeFileSync(LOG_FILE, tail, { mode: 0o600 });
        }
      } catch {}
    }
  } catch {
    process.stderr.write(line);
  }
}
