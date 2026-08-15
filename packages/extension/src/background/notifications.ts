// =============================================================================
// RefLoop — Notifications
// PRD §8.7: badge count + chrome.notifications for follow-up alerts.
// =============================================================================

import type { Contact, JobPosting } from '@refloop/core';

/**
 * Fire a chrome.notifications alert when a follow-up becomes READY_TO_SEND.
 * Required for Email (has no passive surface); optional but nice for LinkedIn.
 * PRD §8.7.
 */
export async function notifyFollowUpReady(
  contact: Contact,
  job: JobPosting,
  stage: 'FU1' | 'FU2',
): Promise<void> {
  const stageLabel = stage === 'FU1' ? 'Follow-up 1' : 'Follow-up 2';
  const channelLabel = contact.channel === 'EMAIL' ? '📧 Email' : '💼 LinkedIn';

  await chrome.notifications.create(`refloop:followup:${contact.id}:${stage}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `RefLoop — ${stageLabel} Ready`,
    message: `${channelLabel}: ${contact.firstName} · ${job.jobTitle} at ${job.companyName}`,
    buttons: [{ title: 'Open Dashboard' }],
    requireInteraction: false,
  });
}

/**
 * Update the extension badge with the count of READY_TO_SEND items.
 * 0 → no badge shown.
 */
export async function updateBadge(count: number): Promise<void> {
  const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
  await chrome.action.setBadgeText({ text });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' }); // indigo
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('refloop:') && buttonIndex === 0) {
    // Open the dashboard
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  }
});
