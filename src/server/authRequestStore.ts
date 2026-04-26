// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
import { randomUUID } from "crypto";

export interface PendingAuthRequest {
  id: string;
  sessionId: string;
  toolName: string;
  toolInput: unknown;
  cwd: string;
  project: string;
  createdAt: number;
  timeoutMs: number;
  resolve: (status: "allow" | "deny") => void;
  /** Which bot username pushed the IM message (for display) */
  botUsername: string;
  /** Which chatId the IM message was sent to */
  chatId: string;
  /** IM message ID (for button editing after decision) */
  messageId?: string | number;
}

const store = new Map<string, PendingAuthRequest>();

export function createAuthRequest(
  params: Omit<PendingAuthRequest, "id" | "createdAt" | "resolve"> & {
    timeoutMs: number;
  },
): { id: string; promise: Promise<"allow" | "deny"> } {
  const id = randomUUID().slice(0, 8);
  let resolve!: (status: "allow" | "deny") => void;
  const promise = new Promise<"allow" | "deny">((res) => {
    resolve = res;
  });

  const req: PendingAuthRequest = {
    ...params,
    id,
    createdAt: Date.now(),
    resolve,
  };
  store.set(id, req);

  // Auto-deny on timeout
  setTimeout(() => {
    if (store.has(id)) {
      store.delete(id);
      resolve("deny");
    }
  }, params.timeoutMs);

  return { id, promise };
}

export function resolveAuthRequest(
  id: string,
  status: "allow" | "deny",
): PendingAuthRequest | null {
  const req = store.get(id);
  if (!req) return null;
  store.delete(id);
  req.resolve(status);
  return req;
}

export function getAuthRequest(id: string): PendingAuthRequest | undefined {
  return store.get(id);
}

export function updateMessageId(
  id: string,
  messageId: string | number,
): void {
  const req = store.get(id);
  if (req) req.messageId = messageId;
}
