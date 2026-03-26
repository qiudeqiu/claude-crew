import type { Bot } from "grammy";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { INBOX_DIR, loadPool } from "./config.js";
import { log } from "./logger.js";

// ── Git helpers ──
export function gitInfo(
  dir: string,
): { branch: string; lastCommit: string; lastCommitAge: string } | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dir,
      timeout: 5000,
    })
      .toString()
      .trim();
    const gitLog = execSync('git log -1 --format="%s|||%cr"', {
      cwd: dir,
      timeout: 5000,
    })
      .toString()
      .trim();
    const [lastCommit, lastCommitAge] = gitLog.split("|||");
    return {
      branch,
      lastCommit: lastCommit ?? "",
      lastCommitAge: lastCommitAge ?? "",
    };
  } catch {
    return null;
  }
}

// ── Stats formatting ──
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

// ── Tool label for progress display ──
export function formatToolLabel(
  name: string,
  input: Record<string, unknown>,
): string {
  const file =
    String(input.file_path ?? "")
      .split("/")
      .pop() ?? "";
  switch (name) {
    case "Bash":
      return `Bash: ${String(input.command ?? "").slice(0, 50)}`;
    case "Read":
    case "Edit":
    case "Write":
      return `${name}: ${file}`;
    case "Grep":
      return `Grep: ${String(input.pattern ?? "")}`;
    case "Glob":
      return `Glob: ${String(input.pattern ?? "")}`;
    default:
      return name;
  }
}

// ── Telegram message splitting ──
export function splitMessage(text: string, limit = 4096): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  return chunks;
}

// ── Download photo ──
export async function downloadPhoto(
  botApi: Bot["api"],
  token: string,
  fileId: string,
): Promise<string | undefined> {
  try {
    mkdirSync(INBOX_DIR, { recursive: true });
    const file = await botApi.getFile(fileId);
    if (!file.file_path) return undefined;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = file.file_path.split(".").pop() ?? "jpg";
    const path = join(INBOX_DIR, `${Date.now()}.${ext}`);
    writeFileSync(path, buf);
    return path;
  } catch {
    return undefined;
  }
}

// ── Download and transcribe voice ──
export async function transcribeVoice(
  botApi: Bot["api"],
  token: string,
  fileId: string,
): Promise<{ path: string; text: string } | undefined> {
  try {
    mkdirSync(INBOX_DIR, { recursive: true });
    const file = await botApi.getFile(fileId);
    if (!file.file_path) return undefined;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    const oggPath = join(INBOX_DIR, `${Date.now()}.ogg`);
    writeFileSync(oggPath, buf);

    const wavPath = oggPath.replace(".ogg", ".wav");
    try {
      execSync(
        `ffmpeg -y -i "${oggPath}" -ar 16000 -ac 1 "${wavPath}" 2>/dev/null`,
        { timeout: 15000 },
      );
    } catch {
      return { path: oggPath, text: "" };
    }

    try {
      const pool = loadPool();
      const whisperArgs = [
        wavPath,
        "--model",
        "turbo",
        "--output_format",
        "txt",
        "--output_dir",
        INBOX_DIR,
      ];
      if (pool.whisperLanguage && /^[a-z]{2,10}$/i.test(pool.whisperLanguage)) {
        whisperArgs.push("--language", pool.whisperLanguage);
      }
      require("child_process").execFileSync("whisper", whisperArgs, {
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const txtPath = wavPath.replace(".wav", ".txt");
      const text = existsSync(txtPath)
        ? readFileSync(txtPath, "utf8").trim()
        : "";
      try {
        unlinkSync(oggPath);
        unlinkSync(wavPath);
        unlinkSync(txtPath);
      } catch {}
      return { path: wavPath, text };
    } catch (err) {
      log(`WHISPER_ERROR: ${err}`);
      return { path: oggPath, text: "" };
    }
  } catch {
    return undefined;
  }
}

// ── Safe environment for Claude subprocesses ──
const SENSITIVE_ENV_PATTERNS = [
  "TELEGRAM_",
  "BOT_",
  "ANTHROPIC_API",
  "OPENAI_API",
  "AWS_SECRET",
  "AWS_SESSION",
  "GITHUB_TOKEN",
  "NPM_TOKEN",
  "DOCKER_PASSWORD",
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "REDIS_URL",
  "STRIPE_",
  "_SECRET",
  "_TOKEN",
  "_PASSWORD",
  "_KEY",
];

const SAFE_EXACT = new Set([
  "PATH",
  "HOME",
  "SHELL",
  "LANG",
  "USER",
  "TERM",
  "TMPDIR",
]);
const SAFE_PREFIXES = ["XDG_"];

export function getSafeEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => {
      const upper = k.toUpperCase();
      return !SENSITIVE_ENV_PATTERNS.some(
        (pat) =>
          upper.includes(pat) &&
          !(
            SAFE_EXACT.has(upper) ||
            SAFE_PREFIXES.some((p) => upper.startsWith(p))
          ),
      );
    }),
  ) as Record<string, string>;
}
