// =============================================================================
// RefLoop — Gmail Sync Runner
// Single entry point for LinkedIn acceptance detection via Gmail metadata.
// Called from: extension startup, chrome.alarms, and the manual "Sync Now" button.
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';
import { parseLinkedInAcceptanceEmail, findMatchingContacts } from '@refloop/core';
import { getGmailToken, clearGmailToken } from '../auth/gmailAuth.js';
import { listMessageIds, getMessageMetadata, GmailAuthError } from './gmailClient.js';

/**
 * Run a full LinkedIn acceptance detection cycle:
 * 1. Check if Gmail is connected — bail early if not.
 * 2. Fetch up to 100 recent message IDs.
 * 3. For each unseen message, fetch metadata (From / Subject / Date only).
 * 4. Detect LinkedIn acceptance emails and match against PENDING contacts.
 * 5. Update matched contacts and persist processed message IDs.
 */
export async function syncLinkedInAcceptances(): Promise<void> {
  const repos = await createChromeRepositories();

  // ---- 1. Guard: only run if Gmail is connected ----
  const syncState = await repos.gmailSync.getSyncState();
  if (!syncState.connected) return;

  let token: string;
  try {
    // Non-interactive — never prompt the user during background runs
    token = await getGmailToken(false);
  } catch {
    // Token is gone / expired — mark disconnected so the UI shows "Reconnect"
    await repos.gmailSync.setSyncState({
      connected: false,
      lastSyncStatus: 'FAILED',
      lastSyncError: 'Token expired or unavailable. Please reconnect Gmail.',
    });
    return;
  }

  try {
    // ---- 2. Fetch recent message IDs ----
    const messageIds = await listMessageIds(token, 100);

    // Load all contacts once — we'll filter inside the loop
    const allContacts = await repos.contacts.getAll();

    // ---- 3. Process each message ----
    for (const id of messageIds) {
      // Skip already-processed messages
      if (await repos.gmailSync.isProcessed(id)) continue;

      let metadata: Awaited<ReturnType<typeof getMessageMetadata>>;
      try {
        metadata = await getMessageMetadata(token, id);
      } catch (err) {
        if (err instanceof GmailAuthError) throw err; // re-throw to outer catch
        // Other transient errors (network etc.) — skip this message, try next cycle
        continue;
      }

      // ---- 4. Parse and match ----
      const { isLinkedInAcceptance, extractedName } = parseLinkedInAcceptanceEmail(
        metadata.from,
        metadata.subject,
      );

      if (!isLinkedInAcceptance || !extractedName) {
        await repos.gmailSync.addProcessedMessageId(id);
        continue;
      }

      const matches = findMatchingContacts(extractedName, allContacts);

      if (matches.length === 0) {
        // No stored contact for this person — mark as processed, move on
        await repos.gmailSync.addProcessedMessageId(id);
        continue;
      }

      if (matches.length === 1) {
        // Exact match — mark ACCEPTED
        const contact = matches[0]!;
        await repos.contacts.update(contact.id, {
          connectionStatus: 'ACCEPTED',
          connectionAcceptedAt: new Date().toISOString(),
          acceptanceGmailMessageId: id,
        });
        console.info(`[RefLoop] Gmail sync: accepted — ${contact.firstName} (${contact.id})`);
      } else {
        // Ambiguous — mark all candidates as REVIEW_REQUIRED
        for (const contact of matches) {
          await repos.contacts.update(contact.id, {
            connectionStatus: 'REVIEW_REQUIRED',
            acceptanceGmailMessageId: id,
          });
        }
        console.info(
          `[RefLoop] Gmail sync: ambiguous match for "${extractedName}" — ${matches.length} candidates`,
        );
      }

      await repos.gmailSync.addProcessedMessageId(id);
    }

    // ---- 5. Record success ----
    await repos.gmailSync.setSyncState({
      lastCheckedAt: Date.now(),
      lastSyncStatus: 'SUCCESS',
      lastSyncError: null,
    });
  } catch (err) {
    if (err instanceof GmailAuthError) {
      // Token was revoked mid-sync — clear it and mark disconnected
      await clearGmailToken();
      await repos.gmailSync.setSyncState({
        connected: false,
        lastSyncStatus: 'FAILED',
        lastSyncError: 'Gmail authorization was revoked. Please reconnect.',
      });
      return;
    }

    // Other errors (network, API quota, etc.) — record failure, keep connected state
    const message = err instanceof Error ? err.message : String(err);
    await repos.gmailSync.setSyncState({
      lastCheckedAt: Date.now(),
      lastSyncStatus: 'FAILED',
      lastSyncError: message,
    });
    console.error('[RefLoop] Gmail sync failed:', err);
  }
}

/**
 * Convenience wrapper used during extension startup.
 * Checks settings before running — never prompts the user interactively.
 */
export async function syncLinkedInAcceptancesIfConnected(): Promise<void> {
  try {
    const repos = await createChromeRepositories();
    const settings = await repos.settings.get();
    if (!settings.proModeEnabled || !settings.gmailSyncEnabled) return;
    await syncLinkedInAcceptances();
  } catch (err) {
    console.error('[RefLoop] Gmail startup sync error:', err);
  }
}
