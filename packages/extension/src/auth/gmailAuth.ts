// =============================================================================
// RefLoop — Gmail Auth
// Manages the gmail.metadata OAuth token separately from the Google Sign-In
// token. Uses the same Chrome extension OAuth client (declared in manifest).
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.metadata';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Get a Gmail-scoped OAuth token.
 * @param interactive - true only when the user explicitly clicked "Connect Gmail".
 *                      Always false during alarms / startup.
 */
export function getGmailToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: [GMAIL_SCOPE] }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Gmail auth failed'));
        return;
      }
      resolve(token);
    });
  });
}

/** Evict the cached Gmail token from Chrome's token cache. */
export function clearGmailToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false, scopes: [GMAIL_SCOPE] }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => resolve());
      } else {
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect Gmail:
 * 1. Obtain an interactive OAuth token (triggers the Google consent screen).
 * 2. Mark gmailSync.connected = true in storage.
 */
export async function connectGmail(): Promise<void> {
  // This will throw if the user cancels or if OAuth fails — let the caller handle it.
  await getGmailToken(true);
  const { gmailSync } = await createChromeRepositories();
  await gmailSync.setSyncState({
    connected: true,
    lastSyncStatus: 'NEVER',
    lastSyncError: null,
    lastCheckedAt: null,
  });
}

/**
 * Disconnect Gmail:
 * 1. Clear the cached token.
 * 2. Reset all Gmail sync state (processed message IDs + sync metadata).
 * Stored LinkedIn contacts are NOT modified.
 */
export async function disconnectGmail(): Promise<void> {
  await clearGmailToken();
  const { gmailSync } = await createChromeRepositories();
  await gmailSync.clearSyncState();
  await gmailSync.clearProcessedMessages();
}

/**
 * Returns true if the user has previously connected Gmail
 * (reads chrome.storage — does not make an API call).
 */
export async function isGmailConnected(): Promise<boolean> {
  const { gmailSync } = await createChromeRepositories();
  const state = await gmailSync.getSyncState();
  return state.connected;
}
