// =============================================================================
// RefLoop — Background Service Worker Entry Point
// Technical Design §2.1: "The only place business logic runs unattended."
// Initializes repositories, sets up alarms, and routes messages.
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';
import { setupAlarms } from './alarms.js';
import { messageRouter } from './messageRouter.js';
import { syncLinkedInAcceptancesIfConnected } from './gmailSyncRunner.js';

// Register message routing synchronously on module load so that MV3 service worker
// can immediately handle incoming messages even when waking up from an idle state.
messageRouter();

// Service workers can be killed and restarted by Chrome — we handle this by
// re-running all initialization on every startup.
void init();

async function init() {
  try {
    // Initialize repositories (runs migrations)
    await createChromeRepositories();

    // Register periodic alarms (housekeeping + Gmail sync if Pro Mode enabled)
    await setupAlarms();

    // Run Gmail acceptance detection on startup (non-interactive, no auth prompt)
    await syncLinkedInAcceptancesIfConnected();

    console.log('[RefLoop] Background service worker initialized');
  } catch (err) {
    console.error('[RefLoop] Background init failed:', err);
  }
}

// Re-initialize alarms when the extension is installed or updated.
// Also re-inject the LinkedIn content script into ALL already-open LinkedIn tabs
// (Chrome does NOT re-inject content scripts on extension update/reload).
chrome.runtime.onInstalled.addListener(async () => {
  await setupAlarms();
  console.log('[RefLoop] Extension installed/updated — alarms re-registered');

  // Re-inject content script into all existing LinkedIn tabs
  try {
    const linkedInTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
    for (const tab of linkedInTabs) {
      if (tab.id != null) {
        await injectContentScriptIfNeeded(tab.id);
      }
    }
  } catch (err) {
    console.warn('[RefLoop] Failed to re-inject content scripts on install:', err);
  }
});

// ---------------------------------------------------------------------------
// SPA Navigation Detection — chrome.webNavigation.onHistoryStateUpdated
// When LinkedIn performs pushState / replaceState navigation, we:
//   1. Try sending REFLOOP_NAVIGATED to the existing content script
//   2. If that fails (orphaned/absent), re-inject the content script dynamically
// ---------------------------------------------------------------------------

/** Dynamically inject the LinkedIn content script into a tab using chrome.scripting */
async function injectContentScriptIfNeeded(tabId: number) {
  try {
    // Read the actual content script filename from the manifest (it has a build hash)
    const manifest = chrome.runtime.getManifest();
    const linkedInEntry = manifest.content_scripts?.find(
      (cs) => cs.matches?.some((m) => m.includes('linkedin.com')),
    );
    const scriptFiles = linkedInEntry?.js;
    if (!scriptFiles || scriptFiles.length === 0) {
      console.warn('[RefLoop] Could not find LinkedIn content script in manifest');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: scriptFiles as string[],
    });
    console.log(`[RefLoop] Content script injected into tab ${tabId}`);
  } catch (err) {
    console.warn(`[RefLoop] Failed to inject content script into tab ${tabId}:`, err);
  }
}

/** Try to ping the content script; if it's alive, send the navigation event. Otherwise re-inject. */
async function notifyOrReinject(tabId: number, url: string) {
  try {
    // Try sending the navigation event to an existing content script
    await chrome.tabs.sendMessage(tabId, { type: 'REFLOOP_NAVIGATED', url });
  } catch {
    // Content script is absent or orphaned — dynamically re-inject it
    console.log(`[RefLoop] Content script not responding in tab ${tabId}, re-injecting...`);
    await injectContentScriptIfNeeded(tabId);
  }
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0 && details.url && details.url.includes('linkedin.com')) {
    void notifyOrReinject(details.tabId, details.url);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab?.url;
  if (targetUrl && targetUrl.includes('linkedin.com')) {
    void notifyOrReinject(tabId, targetUrl);
  }
});
