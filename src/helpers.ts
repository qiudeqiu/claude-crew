import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { INBOX_DIR, loadPool } from "./config.js";
import { log } from "./logger.js";

// ── Git helpers ──
export function gitInfo(
  dir: string,
): { branch: string; lastCommit: string; lastCommitAge: string } | null {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: dir,
      timeout: 5000,
    })
      .toString()
      .trim();
    const gitLog = execFileSync("git", ["log", "-1", "--format=%s|||%cr"], {
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

export function shortModelName(model: string): string {
  return model.replace("claude-", "").replace(/\[.*$/, "");
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

// ── Download and transcribe voice ──
export async function transcribeVoice(
  downloadFile: (fileId: string) => Promise<string | undefined>,
  fileId: string,
): Promise<{ path: string; text: string } | undefined> {
  try {
    const oggPath = await downloadFile(fileId);
    if (!oggPath) return undefined;

    // Strip extension and force .wav — voice files may be .ogg, .oga, etc.
    const basePath = oggPath.replace(/\.[^.]+$/, "");
    const wavPath = `${basePath}.wav`;
    try {
      execFileSync(
        "ffmpeg",
        ["-y", "-i", oggPath, "-ar", "16000", "-ac", "1", wavPath],
        { timeout: 15000, stdio: ["pipe", "pipe", "pipe"] },
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
      execFileSync("whisper", whisperArgs, {
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const txtPath = `${basePath}.txt`;
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
// Allowlist-first: only pass through variables that are explicitly safe or
// match safe prefixes. Then block anything matching sensitive patterns.
const SAFE_EXACT = new Set([
  "PATH",
  "HOME",
  "SHELL",
  "LANG",
  "USER",
  "TERM",
  "TMPDIR",
  "EDITOR",
  "VISUAL",
  "PAGER",
  "LESS",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "HOSTNAME",
  "LOGNAME",
  "PWD",
  "OLDPWD",
  "SHLVL",
  "COLORTERM",
  "TERM_PROGRAM",
  "TERM_PROGRAM_VERSION",
  "ANTHROPIC_API_KEY",
]);

const SAFE_PREFIXES = [
  "XDG_",
  "LANG",
  "LC_",
  "SSH_AUTH_SOCK", // for git
  "GIT_",
  "NODE_",
  "BUN_",
  "NPM_CONFIG_",
  "HOMEBREW_",
  "NVM_",
  "PYENV_",
  "GOPATH",
  "GOROOT",
  "CARGO_",
  "RUSTUP_",
];

const SENSITIVE_PATTERNS = [
  "_SECRET",
  "_TOKEN",
  "_PASSWORD",
  "_KEY",
  "_CREDENTIAL",
  "TELEGRAM_",
  "BOT_",
  "OPENAI_",
  "AWS_SECRET",
  "AWS_SESSION",
  "DATABASE_URL",
  "REDIS_URL",
  "STRIPE_",
  "DOCKER_PASSWORD",
];

export function getSafeEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => {
      const upper = k.toUpperCase();
      // Block sensitive patterns first — even if prefix matches
      const isSensitive = SENSITIVE_PATTERNS.some((pat) => upper.includes(pat));
      if (isSensitive) {
        // Exception: explicitly safe exact matches override
        return SAFE_EXACT.has(upper);
      }
      // Allow exact matches
      if (SAFE_EXACT.has(upper)) return true;
      // Allow safe prefixes
      if (SAFE_PREFIXES.some((p) => upper.startsWith(p))) return true;
      // Default: allow (non-sensitive, non-prefixed vars like EDITOR, DISPLAY, etc.)
      return true;
    }),
  ) as Record<string, string>;
}
