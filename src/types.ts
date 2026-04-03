// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import type { Bot } from "grammy";
import type { Platform } from "./platform/types.js";

export type PoolBot = {
  token: string;
  username?: string;
  role?: "master" | "project";
  assignedProject?: string;
  assignedPath?: string;
  accessLevel?: "readWrite" | "readOnly";
  permissionMode?: "allowAll" | "approve" | "auto";
  allowedUsers?: string[];
  model?: string;
  /** List of user IDs who must ALL approve before writes execute. Empty = any admin. */
  approvers?: string[];
};

/** Menu permission that can be granted to secondary admins. */
export type AdminPermission = "bots" | "config" | "users" | "restart" | "cron";

/** Secondary admin with granular menu permissions. */
export type AdminConfig = {
  id: string;
  name?: string;
  permissions: AdminPermission[];
};

/** Flattened view of the active platform's config — what all consuming code sees. */
export type BotPool = {
  platform?: "telegram" | "discord";
  bots: PoolBot[];
  sharedGroupId?: string;
  /** Owner (original admin) ID — immutable after setup. */
  owner?: string;
  /** Owner display name (e.g. "Qiu (@Larson3939)"). */
  ownerName?: string;
  /** Secondary admins with per-feature permissions. */
  admins?: AdminConfig[];
  accessLevel?: "readWrite" | "readOnly";
  permissionMode?: "allowAll" | "approve" | "auto";
  masterExecute?: boolean;
  maxConcurrent?: number;
  rateLimitSeconds?: number;
  sessionTimeoutMinutes?: number;
  dashboardIntervalMinutes?: number;
  language?: string;
  model?: string;
  approvers?: string[];
  /** Session context mode: "continue" resumes last session, "fresh" starts clean each time. */
  sessionMode?: "continue" | "fresh";
};

/** Platform-specific section in the on-disk config. */
export type PlatformSection = {
  /** Owner (original admin) — cannot be removed. */
  owner?: string;
  ownerName?: string;
  /** Secondary admins with granular permissions. */
  admins?: AdminConfig[];
  approvers?: string[];
  sharedGroupId?: string;
  bots: PoolBot[];
};

/** On-disk config format — platform sections + shared settings. */
export type RawBotPool = {
  activePlatform?: "telegram" | "discord";
  telegram?: PlatformSection;
  discord?: PlatformSection;
  // Shared settings (platform-agnostic)
  accessLevel?: "readWrite" | "readOnly";
  permissionMode?: "allowAll" | "approve" | "auto";
  masterExecute?: boolean;
  maxConcurrent?: number;
  rateLimitSeconds?: number;
  sessionTimeoutMinutes?: number;
  dashboardIntervalMinutes?: number;
  language?: string;
  model?: string;
  sessionMode?: "continue" | "fresh";
};

export type ManagedBot = {
  config: PoolBot;
  bot: Bot;
  platform: Platform;
  busy: boolean;
  lastInvoke: number;
  lastActivity: number;
  contextUsed: number;
  contextWindow: number;
  lastModel: string;
  lastCostUSD: number;
  /** Skip --continue on next invocation (set by /new command) */
  skipContinue?: boolean;
  /** Override effort level for next invocation (set by /effort command) */
  effort?: string;
  /** Task queue for when bot is busy */
  queue: QueuedTask[];
};

export type QueuedTask = {
  chatId: string;
  userId: string;
  message: string;
  imagePath?: string;
  queuedAt: number;
  /** Display name for @mention in results */
  requesterName?: string;
};

export type CronJob = {
  id: string;
  botUsername: string;
  schedule: string;
  prompt: string;
  lastRun?: string;
  enabled: boolean;
};

export type ClaudeResult = {
  text: string;
  permissionDenials: string[];
  costUSD: number;
  durationMs: number;
  numTurns: number;
  tokensByModel: Record<string, number>;
  contextUsed: number;
  contextWindow: number;
  model: string;
  /** Why the session stopped (e.g. "end_turn", "max_output_tokens"). */
  stopReason: string;
  /** Process exit code (0 = success). */
  exitCode: number;
  /** Whether the stream contained a result event. */
  gotResultEvent: boolean;
};

// ── Interactive setup ──
export type ConversationStep =
  | "idle"
  // Onboarding
  | "onboard:awaitToken"
  | "onboard:awaitProject"
  | "onboard:awaitPath"
  | "onboard:confirm"
  // Bot management
  | "bot:awaitToken"
  | "bot:awaitProject"
  | "bot:awaitPath"
  // Config editing
  | "config:awaitValue"
  // User management
  | "user:awaitAdmin"
  | "user:awaitUser"
  | "user:awaitAdminPerms";

export type ConversationState = {
  step: ConversationStep;
  chatId: string;
  userId: string;
  data: Record<string, string>;
  expiresAt: number;
};

export type SessionStats = {
  totalCostUSD: number;
  totalDurationMs: number;
  totalInvocations: number;
  tokensByModel: Record<string, number>;
};
