import { deleteUser } from "../db/repositories/users";

const GUEST_DISCONNECT_DELAY_MS = 30_000;

interface GuestEntry {
  timeoutRef: ReturnType<typeof setTimeout> | null;
  sessionIds: Set<string>;
}

const guestConnections = new Map<string, GuestEntry>();

export function recordJoin(userId: string, sessionId: string): void {
  let entry = guestConnections.get(userId);
  if (!entry) {
    entry = {
      timeoutRef: null,
      sessionIds: new Set()
    };
    guestConnections.set(userId, entry);
  }

  if (entry.timeoutRef) {
    clearTimeout(entry.timeoutRef);
    entry.timeoutRef = null;
  }
  entry.sessionIds.add(sessionId);
}

export function recordLeave(userId: string, sessionId: string): void {
  const entry = guestConnections.get(userId);
  if (!entry) {
    return;
  }

  entry.sessionIds.delete(sessionId);

  if (entry.sessionIds.size > 0) {
    return;
  }

  if (entry.timeoutRef) {
    clearTimeout(entry.timeoutRef);
  }
  entry.timeoutRef = setTimeout(() => {
    guestConnections.delete(userId);
    deleteUser(userId).catch(() => {
      // Ignore delete errors (e.g. user already removed)
    });
  }, GUEST_DISCONNECT_DELAY_MS);
}
