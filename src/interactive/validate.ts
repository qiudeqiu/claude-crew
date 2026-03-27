import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import type { Api } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import type { ConversationStep } from "../types.js";
import { loadPool } from "../config.js";
import { setConversation } from "./state.js";
import { getLang, common } from "./i18n.js";

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

// ── Shared token input handler ──
// Used by both onboarding and bot-management flows to deduplicate
// the regex check → duplicate check → API validate → setConversation flow.
export async function handleTokenValidation(
  api: Api,
  chatId: string,
  userId: string,
  text: string,
  nextStep: ConversationStep,
  cancelKb: { reply_markup: { inline_keyboard: InlineKeyboardButton[][] } },
  msgs: {
    invalidToken: string;
    duplicateToken: string;
    validating: string;
    invalidTokenApi: string;
    foundBot: (username: string) => string;
  },
): Promise<boolean> {
  const token = text.trim();

  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    await api.sendMessage(chatId, msgs.invalidToken, cancelKb).catch(() => {});
    return true;
  }

  const pool = loadPool();
  if (pool.bots.some((b) => b.token === token)) {
    await api
      .sendMessage(chatId, msgs.duplicateToken, cancelKb)
      .catch(() => {});
    return true;
  }

  const statusMsg = await api
    .sendMessage(chatId, msgs.validating)
    .catch(() => null);
  const result = await validateBotToken(token);

  if (!result.ok) {
    if (statusMsg) {
      await api
        .editMessageText(
          chatId,
          statusMsg.message_id,
          msgs.invalidTokenApi,
          cancelKb,
        )
        .catch(() => {});
    }
    return true;
  }

  const suffix =
    nextStep === "bot:awaitProject" ? common(getLang()).replyHint : "";
  if (statusMsg) {
    await api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        msgs.foundBot(result.username!) + suffix,
        cancelKb,
      )
      .catch(() => {});
  }

  setConversation(userId, chatId, nextStep, {
    token,
    username: result.username!,
  });
  return true;
}
