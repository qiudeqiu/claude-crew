/**
 * Resilience module — circuit breaker, denial tracking, error classification.
 *
 * Inspired by Claude Code's internal resilience patterns:
 * - Circuit breaker (§3/§7): prevent token waste on persistent failures
 * - Denial tracking (§7): prevent approve-mode infinite loops
 * - Error classification (§17): different recovery per error type
 * - Adaptive rate limiting (§19): respect API rate limit resets
 */
import {
  CIRCUIT_BREAKER_MAX_FAILURES,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  DENIAL_MAX_CONSECUTIVE,
  DENIAL_WINDOW_MS,
  MAX_TRUNCATION_RECOVERIES,
} from "./config.js";
import { log } from "./logger.js";

// ══════════════════════════════════════
// ── Circuit Breaker ──
// ══════════════════════════════════════
// Tracks consecutive failures per bot. After N failures, trips open.
// Auto-recovers after cooldown (half-open → success resets, failure re-trips).

type CircuitState = {
  consecutiveFailures: number;
  trippedAt: number | null;
  lastError: string;
};

const circuits = new Map<string, CircuitState>();

/** Returns true if the circuit is open (bot should NOT be invoked). */
export function isCircuitOpen(botKey: string): boolean {
  const state = circuits.get(botKey);
  if (!state?.trippedAt) return false;

  // Auto-recover after cooldown (half-open state)
  if (Date.now() - state.trippedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
    log(`CIRCUIT: ${botKey} — half-open, allowing probe`);
    return false;
  }
  return true;
}

/** Record a successful invocation — resets the circuit. */
export function recordSuccess(botKey: string): void {
  if (circuits.has(botKey)) {
    circuits.set(botKey, {
      consecutiveFailures: 0,
      trippedAt: null,
      lastError: "",
    });
  }
}

/** Record a failure. Returns true if the circuit just tripped. */
export function recordFailure(botKey: string, error: string): boolean {
  const prev = circuits.get(botKey) ?? {
    consecutiveFailures: 0,
    trippedAt: null,
    lastError: "",
  };
  const failures = prev.consecutiveFailures + 1;
  const tripped = failures >= CIRCUIT_BREAKER_MAX_FAILURES;

  circuits.set(botKey, {
    consecutiveFailures: failures,
    trippedAt: tripped ? Date.now() : prev.trippedAt,
    lastError: error.slice(0, 200),
  });

  if (tripped) {
    log(
      `CIRCUIT: ${botKey} — TRIPPED after ${failures} failures: ${error.slice(0, 200)}`,
    );
  }
  return tripped;
}

/** Force-trip the circuit (e.g., on auth errors). */
export function tripCircuit(botKey: string, reason: string): void {
  circuits.set(botKey, {
    consecutiveFailures: CIRCUIT_BREAKER_MAX_FAILURES,
    trippedAt: Date.now(),
    lastError: reason.slice(0, 200),
  });
  log(`CIRCUIT: ${botKey} — FORCE TRIPPED: ${reason.slice(0, 200)}`);
}

/** Manual reset (e.g., admin command or config change). */
export function resetCircuit(botKey: string): void {
  circuits.delete(botKey);
}

/** Get circuit state for dashboard/display (no side effects, no logging). */
export function getCircuitInfo(botKey: string): {
  failures: number;
  tripped: boolean;
  trippedAt: number | null;
  lastError: string;
} | null {
  const state = circuits.get(botKey);
  if (!state) return null;
  // Inline tripped check to avoid isCircuitOpen's log side-effect
  const tripped =
    state.trippedAt !== null &&
    Date.now() - state.trippedAt <= CIRCUIT_BREAKER_COOLDOWN_MS;
  return {
    failures: state.consecutiveFailures,
    tripped,
    trippedAt: state.trippedAt,
    lastError: state.lastError,
  };
}

// ══════════════════════════════════════
// ── Denial Tracking ──
// ══════════════════════════════════════
// Tracks approval denials (user clicks Skip) per bot within a sliding window.
// After N denials in the window, returns true → caller should pause approvals.

type DenialState = {
  timestamps: number[];
};

const denials = new Map<string, DenialState>();

/** Record a denial. Returns true if the denial limit was reached. */
export function recordDenial(botKey: string): boolean {
  let state = denials.get(botKey);
  if (!state) {
    state = { timestamps: [] };
    denials.set(botKey, state);
  }
  const now = Date.now();
  state.timestamps.push(now);

  // Prune entries outside the window
  state.timestamps = state.timestamps.filter((t) => now - t < DENIAL_WINDOW_MS);

  if (state.timestamps.length >= DENIAL_MAX_CONSECUTIVE) {
    log(
      `DENIAL: ${botKey} — limit reached (${state.timestamps.length} in ${DENIAL_WINDOW_MS / 1000}s)`,
    );
    return true;
  }
  return false;
}

/** Clear denial history (e.g., after successful approval). */
export function clearDenials(botKey: string): void {
  denials.delete(botKey);
}

// ══════════════════════════════════════
// ── Error Classification ──
// ══════════════════════════════════════
// Classifies errors from stderr/exit code into actionable categories.
// Each category triggers a different recovery path in the caller.

export type ErrorClass =
  | "rate_limit" // API rate limit — delay until reset
  | "context_full" // Prompt too long — auto-compact
  | "auth_error" // Invalid API key — circuit break immediately
  | "process_crash" // Non-zero exit — increment circuit breaker
  | "timeout" // Already handled by caller
  | "transient"; // Temporary error — safe to retry

export function classifyError(
  exitCode: number,
  stderr: string,
  timedOut: boolean,
): ErrorClass {
  if (timedOut) return "timeout";

  const lower = stderr.toLowerCase();

  // Rate limit (429)
  if (lower.includes("rate limit") || lower.includes("429 too many"))
    return "rate_limit";

  // Context / prompt too long (413 or explicit message)
  if (
    lower.includes("prompt_too_long") ||
    lower.includes("prompt is too long") ||
    lower.includes("413")
  )
    return "context_full";

  // Auth errors (401, invalid key)
  if (
    lower.includes("401") ||
    lower.includes("authentication") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("unauthorized")
  )
    return "auth_error";

  // Process crashed
  if (exitCode !== 0) return "process_crash";

  return "transient";
}

// ══════════════════════════════════════
// ── Output Truncation Detection ──
// ══════════════════════════════════════
// Detects if Claude's output was truncated (max_output_tokens hit).
// Caller can auto-continue to recover the full response.

/** Check if a result was truncated and should be continued. */
export function shouldAutoContinue(
  stopReason: string,
  recoveryCount: number,
): boolean {
  if (stopReason !== "max_output_tokens") return false;
  return recoveryCount < MAX_TRUNCATION_RECOVERIES;
}

// ══════════════════════════════════════
// ── Adaptive Rate Limit ──
// ══════════════════════════════════════
// Uses the rate_limit_event data captured during stream parsing.
// Returns milliseconds to wait before the next invocation is safe.

export function getAdaptiveDelay(
  rateLimitInfo: {
    resetsAt: number;
    rateLimitType: string;
    status: string;
  } | null,
): number {
  if (!rateLimitInfo) return 0;
  // Only block when actually rate-limited, not on warnings
  // status: "allowed" = ok, "allowed_warning" = close to limit, "blocked" = rate limited
  if (
    rateLimitInfo.status === "allowed" ||
    rateLimitInfo.status === "allowed_warning"
  )
    return 0;
  const now = Date.now();
  const resetMs = rateLimitInfo.resetsAt * 1000; // resetsAt is Unix seconds
  if (resetMs > now) return resetMs - now;
  return 0;
}

/** Format adaptive delay for user display. */
export function formatDelay(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.ceil(s / 60)}m`;
}
