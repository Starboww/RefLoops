// =============================================================================
// RefLoop — Gmail Sync Runner
// Single entry point for LinkedIn acceptance detection via Gmail metadata.
// Called from: extension startup, chrome.alarms, and the manual "Sync Now" button.
//
// Two-step sync flow:
//   Step A — New emails: fetch recent message IDs, process each unseen one.
//   Step B — Retry cache: re-attempt matching for LinkedIn acceptances that had
//             0 contact matches on first sight (e.g. contact added after email arrived).
// =============================================================================

import { createChromeRepositories, type ChromeRepositories } from '@refloop/storage-chrome';
import type { Contact } from '@refloop/core';
import {
  parseLinkedInAcceptanceEmail,
  findMatchingContacts,
} from '@refloop/core';
import { getGmailToken, clearGmailToken } from '../auth/gmailAuth.js';
import { listMessageIds, getMessageMetadata, GmailAuthError } from './gmailClient.js';

/**
 * Run a full LinkedIn acceptance detection cycle:
 *
 * Step A — New emails:
 *   1. Fetch up to 100 recent message IDs.
 *   2. Skip already-processed IDs.
 *   3. Fetch metadata (From / Subject / Date only).
 *   4. Non-LinkedIn or non-acceptance → mark processed, skip.
 *   5. Run token-subset matching against PENDING contacts:
 *        0 matches → add to unmatched cache (NOT processed), retry next sync
 *        1 match, AUTO_ACCEPT → mark ACCEPTED, add to processed
 *        any NEEDS_REVIEW → mark all REVIEW_REQUIRED, add to processed
 *
 * Step B — Retry unmatched cache:
 *   6. For each cached unmatched acceptance, re-run matching:
 *        AUTO_ACCEPT → mark ACCEPTED, remove from cache, add to processed
 *        NEEDS_REVIEW → mark REVIEW_REQUIRED, remove from cache, add to processed
 *        NO_MATCH + expired (> 30 days) → discard, add to processed
 *        NO_MATCH + fresh → leave in cache for next sync
 */
export async function syncLinkedInAcceptances(): Promise<void> {
  const repos = await createChromeRepositories();

  // ---- Guard: only run if Gmail is connected ----
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
    // ---- Step A: Process new emails ----
    const messageIds = await listMessageIds(token, 100);
    const allContacts = await repos.contacts.getAll();

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

      // Not a LinkedIn acceptance → junk/other, mark processed and move on
      const { isLinkedInAcceptance, extractedName } = parseLinkedInAcceptanceEmail(
        metadata.from,
        metadata.subject,
      );

      if (!isLinkedInAcceptance || !extractedName) {
        await repos.gmailSync.addProcessedMessageId(id);
        continue;
      }

      // LinkedIn acceptance email — run token-subset matching
      await applyMatchResult(id, extractedName, allContacts, repos, false);
    }

    // ---- Step B: Retry unmatched acceptances cache ----
    // Re-run matching for emails that had 0 contacts last time they were seen.
    // This covers the case where a contact was added AFTER the email arrived.
    const unmatched = await repos.gmailSync.getUnmatchedAcceptances();
    if (unmatched.length > 0) {
      // Reload contacts — new ones may have been added since Step A
      const freshContacts = await repos.contacts.getAll();

      for (const entry of unmatched) {
        const outcome = await applyMatchResult(
          entry.messageId,
          entry.extractedName,
          freshContacts,
          repos,
          true, // isRetry — skip "add to cache" logic
        );

        if (outcome === 'matched') {
          await repos.gmailSync.removeUnmatchedAcceptance(entry.messageId);
        } else if (outcome === 'expired') {
          // 30-day expiry — give up
          await repos.gmailSync.addProcessedMessageId(entry.messageId);
          await repos.gmailSync.removeUnmatchedAcceptance(entry.messageId);
        }
        // 'still_unmatched' → leave in cache, retry next sync
      }
    }

    // ---- Record success ----
    await repos.gmailSync.setSyncState({
      lastCheckedAt: Date.now(),
      lastSyncStatus: 'SUCCESS',
      lastSyncError: null,
    });
  } catch (err) {
    if (err instanceof GmailAuthError) {
      await clearGmailToken();
      await repos.gmailSync.setSyncState({
        connected: false,
        lastSyncStatus: 'FAILED',
        lastSyncError: 'Gmail authorization was revoked. Please reconnect.',
      });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    await repos.gmailSync.setSyncState({
      lastCheckedAt: Date.now(),
      lastSyncStatus: 'FAILED',
      lastSyncError: message,
    });
    console.error('[RefLoop] Gmail sync failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type MatchOutcome = 'matched' | 'still_unmatched' | 'expired';

/**
 * Run the token-subset matcher for one Gmail acceptance email and apply
 * the result to contact storage.
 *
 * @param isRetry  true when called from Step B (cache retry loop)
 * Returns:
 *   'matched'         — contacts updated (ACCEPTED or REVIEW_REQUIRED)
 *   'still_unmatched' — 0 contacts matched, leave in cache
 *   'expired'         — 0 contacts matched AND > 30 days old
 *   void              — new email with no match, added to cache (Step A path)
 */
async function applyMatchResult(
  messageId: string,
  extractedName: string,
  allContacts: Contact[],
  repos: ChromeRepositories,
  isRetry: boolean,
): Promise<MatchOutcome | void> {
  const matches = findMatchingContacts(extractedName, allContacts);

  if (matches.length === 0) {
    if (isRetry) {
      // Check whether this entry is still in the cache (not yet expired).
      // getUnmatchedAcceptances() auto-prunes expired entries, so if it's gone
      // from the list, it already passed the 30-day mark.
      const cache = await repos.gmailSync.getUnmatchedAcceptances();
      const stillPresent = cache.some((e) => e.messageId === messageId);
      if (!stillPresent) {
        console.info(`[RefLoop] Gmail retry: "${extractedName}" expired — discarding`);
        return 'expired';
      }
      console.info(`[RefLoop] Gmail retry: still no match for "${extractedName}"`);
      return 'still_unmatched';
    }

    // First-time, no matches → store in retry cache (NOT in processed list)
    await repos.gmailSync.addUnmatchedAcceptance(messageId, extractedName);
    console.info(`[RefLoop] Gmail sync: no match for "${extractedName}" — queued for retry`);
    return;
  }

  // Determine overall decision: any NEEDS_REVIEW → all become REVIEW_REQUIRED
  const autoAcceptMatches = matches.filter((m) => m.decision === 'AUTO_ACCEPT');
  const isUnambiguous = autoAcceptMatches.length === 1 && matches.length === 1;

  if (isUnambiguous) {
    // Single clean match — auto-mark ACCEPTED
    const { contact } = autoAcceptMatches[0]!;
    await repos.contacts.update(contact.id, {
      connectionStatus: 'ACCEPTED',
      connectionAcceptedAt: new Date().toISOString(),
      acceptanceGmailMessageId: messageId,
      outreachMessageStatus:
        contact.outreachMessageStatus === 'QUEUED'
          ? 'READY_TO_SEND'
          : contact.outreachMessageStatus,
    });
    console.info(
      `[RefLoop] Gmail sync: accepted — ${contact.firstName} (${contact.id}) score=${autoAcceptMatches[0]!.score.toFixed(2)}`,
    );
  } else {
    // Ambiguous or partial match — flag all candidates for user review
    for (const match of matches) {
      await repos.contacts.update(match.contact.id, {
        connectionStatus: 'REVIEW_REQUIRED',
        acceptanceGmailMessageId: messageId,
      });
    }
    console.info(
      `[RefLoop] Gmail sync: needs review for "${extractedName}" — ${matches.length} candidate(s)`,
    );
  }

  await repos.gmailSync.addProcessedMessageId(messageId);
  return 'matched';
}

/**
 * Clear the entire sync cache (processed message IDs + unmatched acceptance cache)
 * and run a fresh sync from scratch.
 *
 * Used by the "Reset & Re-sync" button in Settings — the fastest way to fix
 * contacts added after their acceptance email was already processed (Indu scenario).
 */
export async function resetAndResync(): Promise<void> {
  const repos = await createChromeRepositories();
  await repos.gmailSync.clearProcessedMessages();
  await repos.gmailSync.clearUnmatchedAcceptances();
  await syncLinkedInAcceptances();
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
