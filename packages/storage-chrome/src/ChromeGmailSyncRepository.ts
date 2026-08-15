// =============================================================================
// RefLoop — ChromeGmailSyncRepository
// Manages two storage keys:
//   gmailSync:v1          — connection state and last sync metadata
//   gmailProcessedMessages:v1 — bounded list of processed Gmail message IDs
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

const SYNC_STATE_KEY = 'gmailSync:v1';
const PROCESSED_MSGS_KEY = 'gmailProcessedMessages:v1';

/** Maximum number of processed message IDs to retain. Oldest are pruned when exceeded. */
const MAX_PROCESSED_MESSAGES = 1000;

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
}
