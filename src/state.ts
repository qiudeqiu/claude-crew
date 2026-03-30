import type { ManagedBot, SessionStats } from "./types.js";

// ── Shared mutable state ──
export const managedBots = new Map<string, ManagedBot>();
export const botByUsername = new Map<string, ManagedBot>();

export const daemon = {
  masterBot: null as ManagedBot | null,
  activeInvocations: 0,
  rateLimitInfo: null as {
    resetsAt: number;
    rateLimitType: string;
    status: string;
  } | null,
};

export const sessionStats: SessionStats = {
  totalCostUSD: 0,
  totalDurationMs: 0,
  totalInvocations: 0,
  tokensByModel: {},
};

export const pendingApprovals = new Map<
  string,
  {
    resolve: (tools: string | null) => void;
    approvedBy: Set<string>;
    required: number;
    voters: string[];
  }
>();

/** Delegated approval: userId → expiresAt timestamp */
export const delegatedApprovers = new Map<string, number>();

/** Pending vote results: messageId → vote state */
export const pendingVotes = new Map<
  string,
  {
    botToken: string;
    chatId: string;
    messageId: number;
    approvedBy: Set<string>;
    required: number;
    voters: string[];
  }
>();
