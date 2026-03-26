import { existsSync, statSync } from "fs";

export async function validateBotToken(
  token: string,
): Promise<{ ok: boolean; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username: string };
    };
    if (data.ok && data.result) {
      return { ok: true, username: data.result.username };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

const BLOCKED_PATHS = [
  "/",
  "/etc",
  "/var",
  "/usr",
  "/bin",
  "/sbin",
  "/tmp",
  "/dev",
  "/proc",
  "/sys",
];

export function validatePath(path: string): boolean {
  try {
    if (!path.startsWith("/")) return false;

    // Block system-critical directories
    const resolved = require("path").resolve(path);
    if (BLOCKED_PATHS.includes(resolved)) return false;

    // Block sensitive dotfiles in home
    const home = require("os").homedir();
    const rel = resolved.startsWith(home) ? resolved.slice(home.length) : "";
    if (/^\/\.(ssh|gnupg|aws|claude|config\/gcloud)/.test(rel)) return false;

    return existsSync(resolved) && statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}
