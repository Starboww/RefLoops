// =============================================================================
// RefLoop — ChromeGmailSyncRepository
// Manages three storage keys:
//   gmailSync:v1                  — connection state and last sync metadata
//   gmailProcessedMessages:v1     — bounded list of processed Gmail message IDs
//                                   (only LinkedIn emails + matched acceptances)
//   gmailUnmatchedAcceptances:v1  — LinkedIn acceptance emails that had 0 contact
//                                   matches at the time of first sync; retried on
//                                   every subsequent sync until matched or expired.
// =============================================================================

import { storageGet, storageSet, storageRemove } from './changeBus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GmailSyncState {
  connected: boolean;
  lastCheckedAt: number | null;   // epoch ms
  lastSyncStatus: 'SUCCESS' | 'FAILED' | 'NEVER';
  lastSyncError: string | null;
}

/**
 * A LinkedIn acceptance email that had zero contact matches when it was first
 * seen. We keep it in this cache and retry matching on every subsequent sync
 * until a contact is added or the entry expires (30 days).
 */
export interface UnmatchedAcceptance {
  messageId: string;
  extractedName: string;  // e.g. "Indu" — the name extracted from the email subject
  detectedAt: number;     // epoch ms — used for 30-day expiry
}

const SYNC_STATE_KEY = 'gmailSync:v1';
const PROCESSED_MSGS_KEY = 'gmailProcessedMessages:v1';
const UNMATCHED_KEY = 'gmailUnmatchedAcceptances:v1';

/** Maximum number of processed message IDs to retain. Oldest are pruned when exceeded. */
const MAX_PROCESSED_MESSAGES = 1000;

/** Unmatched acceptance entries older than this are discarded. */
const UNMATCHED_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const DEFAULT_SYNC_STATE: GmailSyncState = {
  connected: false,
  lastCheckedAt: null,
  lastSyncStatus: 'NEVER',
  lastSyncError: null,
};

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ChromeGmailSyncRepository {
  // ---- Sync state ----

  async getSyncState(): Promise<GmailSyncState> {
    const stored = await storageGet<Partial<GmailSyncState>>(SYNC_STATE_KEY, {});
    return { ...DEFAULT_SYNC_STATE, ...stored };
  }

  async setSyncState(patch: Partial<GmailSyncState>): Promise<void> {
    const current = await this.getSyncState();
    await storageSet(SYNC_STATE_KEY, { ...current, ...patch });
  }

  async clearSyncState(): Promise<void> {
    await storageRemove(SYNC_STATE_KEY);
  }

  // ---- Processed message IDs ----

  async getProcessedMessages(): Promise<string[]> {
    return storageGet<string[]>(PROCESSED_MSGS_KEY, []);
  }

  /**
   * Add a Gmail message ID to the processed set.
   * Only call this for:
   *   - Non-LinkedIn emails (junk/promotions) — skip forever
   *   - LinkedIn emails that were successfully matched (accepted or review-flagged)
   *   - LinkedIn acceptance emails that have expired from the unmatched cache (> 30 days)
   *
   * Do NOT call this for unmatched LinkedIn acceptances — use addUnmatchedAcceptance instead.
   *
   * Automatically prunes oldest IDs when the list exceeds MAX_PROCESSED_MESSAGES.
   */
  async addProcessedMessageId(id: string): Promise<void> {
    const current = await this.getProcessedMessages();
    if (current.includes(id)) return; // already stored
    const updated = [...current, id];
    // Prune oldest entries if over the cap
    const pruned = updated.length > MAX_PROCESSED_MESSAGES
      ? updated.slice(updated.length - MAX_PROCESSED_MESSAGES)
      : updated;
    await storageSet(PROCESSED_MSGS_KEY, pruned);
  }

  async isProcessed(id: string): Promise<boolean> {
    const current = await this.getProcessedMessages();
    return current.includes(id);
  }

  async clearProcessedMessages(): Promise<void> {
    await storageRemove(PROCESSED_MSGS_KEY);
  }

  // ---- Unmatched acceptances retry cache ----

  /**
   * Returns all non-expired unmatched acceptance entries (< 30 days old).
   * Automatically prunes expired entries from storage on read.
   */
  async getUnmatchedAcceptances(): Promise<UnmatchedAcceptance[]> {
    const all = await storageGet<UnmatchedAcceptance[]>(UNMATCHED_KEY, []);
    const now = Date.now();
    const fresh = all.filter((e) => now - e.detectedAt < UNMATCHED_EXPIRY_MS);
    // Prune expired entries from storage if any were removed
    if (fresh.length !== all.length) {
      await storageSet(UNMATCHED_KEY, fresh);
    }
    return fresh;
  }

  /**
   * Store a LinkedIn acceptance email that had 0 contact matches.
   * It will be retried on every sync for up to 30 days.
   * No-op if the message ID is already in the cache.
   */
  async addUnmatchedAcceptance(messageId: string, extractedName: string): Promise<void> {
    const current = await storageGet<UnmatchedAcceptance[]>(UNMATCHED_KEY, []);
    if (current.some((e) => e.messageId === messageId)) return; // already tracked
    await storageSet(UNMATCHED_KEY, [
      ...current,
      { messageId, extractedName, detectedAt: Date.now() },
    ]);
  }

  /**
   * Remove an entry from the unmatched cache (call when a match is found or
   * when the entry is being permanently discarded after expiry).
   */
  async removeUnmatchedAcceptance(messageId: string): Promise<void> {
    const current = await storageGet<UnmatchedAcceptance[]>(UNMATCHED_KEY, []);
    await storageSet(UNMATCHED_KEY, current.filter((e) => e.messageId !== messageId));
  }

  async clearUnmatchedAcceptances(): Promise<void> {
    await storageRemove(UNMATCHED_KEY);
  }
}
