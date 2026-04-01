import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import type { Platform } from "../platform/types.js";
import type { Button } from "../platform/types.js";
import type { ConversationStep } from "../types.js";
import { loadPool, getPlatform } from "../config.js";
import { setConversation } from "./state.js";
import { getLang, common } from "./i18n.js";
import { send, edit } from "./keyboards.js";

async function validateTelegramToken(
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

async function validateDiscordToken(
  token: string,
): Promise<{ ok: boolean; username?: string }> {
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { username?: string };
    return data.username
      ? { ok: true, username: data.username }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function validateBotToken(
  token: string,
): Promise<{ ok: boolean; username?: string }> {
  return getPlatform() === "discord"
    ? validateDiscordToken(token)
    : validateTelegramToken(token);
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

    // Block system-critical directories and their subdirectories
    const resolved = resolve(path);
    if (
      BLOCKED_PATHS.some(
        (blocked) => resolved === blocked || resolved.startsWith(blocked + "/"),
      )
    )
      return false;

    // Block sensitive dotfiles in home
    const home = homedir();
    const rel = resolved.startsWith(home) ? resolved.slice(home.length) : "";
    if (/^\/\.(ssh|gnupg|aws|claude|config\/gcloud)/.test(rel)) return false;

    return existsSync(resolved) && statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

/** Build Discord bot invite URL from token (extracts app ID from JWT). */
export function buildDiscordInviteUrl(token: string): string {
  try {
    const appId = atob(token.split(".")[0]);
    return `https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot&permissions=387136`;
  } catch {
    return "";
  }
}

// ── Shared token input handler ──
// Used by both onboarding and bot-management flows to deduplicate
// the regex check → duplicate check → API validate → setConversation flow.
export async function handleTokenValidation(
  api: Platform,
  chatId: string,
  userId: string,
  text: string,
  nextStep: ConversationStep,
  cancelKb: { reply_markup: { inline_keyboard: Button[][] } },
  msgs: {
    invalidToken: string;
    duplicateToken: string;
    validating: string;
    invalidTokenApi: string;
    foundBot: (username: string) => string;
  },
): Promise<boolean> {
  const token = text.trim();

  // Telegram: 123456789:ABCdefGHI...  Discord: base64.base64.base64
  const tokenPattern =
    getPlatform() === "discord"
      ? /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
      : /^\d+:[A-Za-z0-9_-]+$/;
  if (!tokenPattern.test(token)) {
    await send(api, chatId, msgs.invalidToken, cancelKb).catch(() => {});
    return true;
  }

  const pool = loadPool();
  if (pool.bots.some((b) => b.token === token)) {
    await send(api, chatId, msgs.duplicateToken, cancelKb).catch(() => {});
    return true;
  }

  const statusMsg = await api
    .sendMessage(chatId, msgs.validating)
    .catch(() => null);
  const result = await validateBotToken(token);

  if (!result.ok) {
    if (statusMsg) {
      await edit(
        api,
        chatId,
        statusMsg.id,
        msgs.invalidTokenApi,
        cancelKb,
      ).catch(() => {});
    }
    return true;
  }

  const suffix =
    nextStep === "bot:awaitProject" ? common(getLang()).replyHint : "";
  if (statusMsg) {
    await edit(
      api,
      chatId,
      statusMsg.id,
      msgs.foundBot(result.username!) + suffix,
      cancelKb,
    ).catch(() => {});
  }

  setConversation(userId, chatId, nextStep, {
    token,
    username: result.username!,
  });
  return true;
}
