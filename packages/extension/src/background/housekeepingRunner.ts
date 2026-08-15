// =============================================================================
// RefLoop — Housekeeping Runner
// Technical Design §2.2: runs HousekeepingService and handles notifications.
// Safe to run automatically — read-only to LinkedIn DOM.
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';
import { HousekeepingService, SystemClock } from '@refloop/core';
import { notifyFollowUpReady, updateBadge } from './notifications.js';

// Cache of last-fetched LinkedIn connections (to avoid redundant fetches)
let lastFetchedConnections: Set<string> = new Set();
let lastFetchTime = 0;
const FETCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function runHousekeeping(): Promise<void> {
  try {
    const repos = await createChromeRepositories();
    const clock = new SystemClock();

    // Fetch LinkedIn connections (with cooldown to avoid excessive requests)
    const now = Date.now();
    if (now - lastFetchTime > FETCH_COOLDOWN_MS) {
      lastFetchedConnections = await fetchLinkedInConnections();
      lastFetchTime = now;
    }

    const svc = new HousekeepingService(repos.jobs, repos.contacts, repos.settings, clock);
    const result = await svc.run(lastFetchedConnections);

    // Fire notifications for contacts that just became READY_TO_SEND
    for (const notification of result.notifications) {
      await notifyFollowUpReady(notification.contact, notification.job, notification.stage);
    }

    // Update extension badge with total ready count
    const allContacts = await repos.contacts.getAll();
    const readyCount = allContacts.filter(
      (c) =>
        c.outreachMessageStatus === 'READY_TO_SEND' ||
        c.followUp1Status === 'READY_TO_SEND' ||
        c.followUp2Status === 'READY_TO_SEND',
    ).length;
    await updateBadge(readyCount);

    if (result.dailyCapExceeded) {
      console.info(`[RefLoop] Daily send cap (${result.sentTodayCount}) reached — soft warning`);
    }

    if (result.archivedJobIds.length > 0) {
      console.info(`[RefLoop] Auto-archived ${result.archivedJobIds.length} job(s)`);
    }
  } catch (err) {
    console.error('[RefLoop] Housekeeping failed:', err);
  }
}

/**
 * Attempt to fetch the current user's 1st-degree LinkedIn connections.
 * Uses LinkedIn's own network page — read-only, no DOM interaction.
 * PRD §11.3: "fetch your 1st-degree connections list once per session"
 *
 * NOTE: This is a best-effort implementation. LinkedIn's internal API
 * endpoints change. If this fails, we fall back to an empty set (no
 * acceptance will be detected via this path — the user can manually
 * mark contacts as accepted).
 */
async function fetchLinkedInConnections(): Promise<Set<string>> {
  try {
    // Ask the LinkedIn tab's content script to fetch connections
    const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
    if (tabs.length === 0) return new Set();

    const activeTab = tabs[0];
    if (!activeTab?.id) return new Set();

    // Send a message to the LinkedIn content script to fetch connections
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'FETCH_CONNECTIONS_REQUEST',
    });

    if (response && Array.isArray((response as { connections?: string[] }).connections)) {
      return new Set((response as { connections: string[] }).connections);
    }
  } catch {
    // LinkedIn tab may not be open or content script not injected
  }
  return new Set();
}
