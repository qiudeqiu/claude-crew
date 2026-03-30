import type { Bot } from "grammy";

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
  voting?: VotingConfig;
  approvalRequired?: number;
  approvalVoters?: string[];
};

export type BotPool = {
  bots: PoolBot[];
  sharedGroupId?: string;
  admins?: string[];
  accessLevel?: "readWrite" | "readOnly";
  permissionMode?: "allowAll" | "approve" | "auto";
  memoryIntervalMinutes?: number;
  masterExecute?: boolean;
  maxConcurrent?: number;
  rateLimitSeconds?: number;
  sessionTimeoutMinutes?: number;
  dashboardIntervalMinutes?: number;
  whisperLanguage?: string;
  language?: string;
  model?: string;
  voting?: VotingConfig;
  approvalRequired?: number;
  approvalVoters?: string[];
};

export type ManagedBot = {
  config: PoolBot;
  bot: Bot;
  busy: boolean;
  lastInvoke: number;
  lastActivity: number;
  lastMemorySave: number;
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
  /** Last context warning timestamp (prevent spamming) */
  lastContextWarning?: number;
};

export type QueuedTask = {
  chatId: string;
  userId: string;
  message: string;
  imagePath?: string;
  queuedAt: number;
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
  hasWriteOps: boolean;
};

export type VotingConfig = {
  enabled: boolean;
  requiredVoters?: string[];
  requiredCount?: number;
  mode?: "any" | "all";
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
  | "user:awaitUser";

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
