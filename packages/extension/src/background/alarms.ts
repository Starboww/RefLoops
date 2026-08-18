// =============================================================================
// RefLoop — Alarms
// Registers periodic alarms. Safe to call multiple times (clears before re-registering).
// Technical Design §2.1
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';

const HOUSEKEEPING_ALARM = 'refloop:housekeeping';
const HOUSEKEEPING_PERIOD_MINUTES = 5;

const GMAIL_SYNC_ALARM = 'refloop:gmail-sync';

// ---- Alarm listeners ----
// Registered at top level synchronously so MV3 service worker can catch alarms immediately
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HOUSEKEEPING_ALARM) {
    chrome.runtime.sendMessage({ type: 'HOUSEKEEPING_RUN' }).catch(() => {
      // Dashboard might not be open — that's fine
    });
    void import('./housekeepingRunner.js').then((m) => m.runHousekeeping());
  }

  if (alarm.name === GMAIL_SYNC_ALARM) {
    void import('./gmailSyncRunner.js').then((m) => m.syncLinkedInAcceptances());
  }
});

export async function setupAlarms(): Promise<void> {
  const repos = await createChromeRepositories();
  const settings = await repos.settings.get();

  // ---- Housekeeping alarm (unchanged) ----
  await chrome.alarms.clear(HOUSEKEEPING_ALARM);
  await chrome.alarms.create(HOUSEKEEPING_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: HOUSEKEEPING_PERIOD_MINUTES,
  });

  // ---- Gmail sync alarm (configurable interval, Pro Mode only) ----
  await chrome.alarms.clear(GMAIL_SYNC_ALARM);
  if (settings.proModeEnabled && settings.gmailSyncEnabled) {
    const periodMinutes = Math.max(1, settings.gmailSyncIntervalHours) * 60;
    await chrome.alarms.create(GMAIL_SYNC_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: periodMinutes,
    });
  }
}

