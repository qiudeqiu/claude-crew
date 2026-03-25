import type { Bot } from "grammy";

export type PoolBot = {
  token: string;
  username?: string;
  role?: "master" | "project";
  assignedProject?: string;
  assignedPath?: string;
  accessLevel?: "readWrite" | "readOnly";
  permissionMode?: "allowAll" | "approve";
  allowedUsers?: string[];
};

export type BotPool = {
  bots: PoolBot[];
  sharedGroupId?: string;
  admins?: string[];
  ownerId?: string;
  accessLevel?: "readWrite" | "readOnly";
  permissionMode?: "allowAll" | "approve";
  memoryIntervalMinutes?: number;
  masterExecute?: boolean;
  maxConcurrent?: number;
  rateLimitSeconds?: number;
  sessionTimeoutMinutes?: number;
  dashboardIntervalMinutes?: number;
  whisperLanguage?: string;
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
};

export type SessionStats = {
  totalCostUSD: number;
  totalDurationMs: number;
  totalInvocations: number;
  tokensByModel: Record<string, number>;
};
