// =============================================================================
// RefLoop — Background Service Worker Entry Point
// Technical Design §2.1: "The only place business logic runs unattended."
// Initializes repositories, sets up alarms, and routes messages.
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';
import { setupAlarms } from './alarms.js';
import { messageRouter } from './messageRouter.js';
import { syncLinkedInAcceptancesIfConnected } from './gmailSyncRunner.js';

// Service workers can be killed and restarted by Chrome — we handle this by
// re-running all initialization on every startup.
void init();

async function init() {
  try {
    // Initialize repositories (runs migrations)
    const repos = await createChromeRepositories();

    // Register periodic alarms (housekeeping + Gmail sync if Pro Mode enabled)
    await setupAlarms();

    // Set up message routing
    messageRouter(repos);

    // Run Gmail acceptance detection on startup (non-interactive, no auth prompt)
    await syncLinkedInAcceptancesIfConnected();

    console.log('[RefLoop] Background service worker initialized');
  } catch (err) {
    console.error('[RefLoop] Background init failed:', err);
  }
}

// Re-initialize alarms when the extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  await setupAlarms();
  console.log('[RefLoop] Extension installed/updated — alarms re-registered');
});
