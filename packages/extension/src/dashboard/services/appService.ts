// =============================================================================
// RefLoop — App Service Facade
// Technical Design §3.4: "one clean surface for all user-initiated actions"
// Dashboard components call these functions — never chrome.runtime.sendMessage directly.
// =============================================================================

import type {
  JobPosting,
  Contact,
  GlobalSettings,
  UserAccount,
  NewJobInput,
  NewLinkedInContactInput,
  NewEmailContactInput,
  Stage,
} from '@refloop/core';
import { createChromeRepositories } from '@refloop/storage-chrome';

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function addJob(input: NewJobInput): Promise<JobPosting> {
  return chrome.runtime.sendMessage({
    type: 'ADD_JOB_REQUEST',
    payload: input,
  }).then((r: { success: boolean; job?: JobPosting; error?: string }) => {
    if (!r.success) throw new Error(r.error ?? 'Failed to add job');
    return r.job!;
  });
}

export async function updateJob(id: string, patch: Partial<JobPosting>): Promise<JobPosting> {
  const repos = await createChromeRepositories();
  return repos.jobs.update(id, patch);
}

export async function deleteJob(id: string): Promise<void> {
  const repos = await createChromeRepositories();
  const allContacts = await repos.contacts.getAll();
  const remainingContacts = allContacts.filter((c) => c.jobPostingId !== id);
  const { storageSet } = await import('@refloop/storage-chrome');
  await storageSet('contacts:v1', remainingContacts);
  await repos.jobs.delete(id);
}

export async function archiveJob(id: string): Promise<void> {
  const repos = await createChromeRepositories();
  // Cancel all pending contacts first
  const contacts = await repos.contacts.getByJobId(id);
  await Promise.all(
    contacts
      .filter((c) => !c.removedAt)
      .map(async (c) => {
        const patch: Partial<Contact> = { removedAt: new Date().toISOString() };
        if (c.outreachMessageStatus === 'QUEUED' || c.outreachMessageStatus === 'READY_TO_SEND') {
          patch.outreachMessageStatus = 'CANCELLED_BY_USER';
        }
        if (c.followUp1Status === 'SCHEDULED' || c.followUp1Status === 'READY_TO_SEND') {
          patch.followUp1Status = 'CANCELLED_BY_USER';
        }
        if (c.followUp2Status === 'SCHEDULED' || c.followUp2Status === 'READY_TO_SEND') {
          patch.followUp2Status = 'CANCELLED_BY_USER';
        }
        return repos.contacts.update(c.id, patch);
      }),
  );
  await repos.jobs.update(id, {
    status: 'ARCHIVED',
    archiveReason: 'MANUAL',
  });
}

export async function markReferralReceived(id: string): Promise<void> {
  const repos = await createChromeRepositories();
  await repos.jobs.update(id, {
    status: 'REFERRAL_RECEIVED',
    referralReceivedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function addLinkedInContact(input: NewLinkedInContactInput): Promise<Contact> {
  return chrome.runtime.sendMessage({
    type: 'ADD_LINKEDIN_CONTACT_REQUEST',
    payload: input,
  }).then((r: { success: boolean; contact?: Contact; error?: string }) => {
    if (!r.success) throw new Error(r.error ?? 'Failed to add contact');
    return r.contact!;
  });
}

export async function addEmailContact(input: NewEmailContactInput): Promise<Contact> {
  return chrome.runtime.sendMessage({
    type: 'ADD_EMAIL_CONTACT_REQUEST',
    payload: input,
  }).then((r: { success: boolean; contact?: Contact; error?: string }) => {
    if (!r.success) throw new Error(r.error ?? 'Failed to add contact');
    return r.contact!;
  });
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
  const repos = await createChromeRepositories();
  return repos.contacts.update(id, patch);
}

export async function deleteContact(id: string): Promise<void> {
  const repos = await createChromeRepositories();
  await repos.contacts.delete(id);
}

export async function markConnectionAccepted(contactId: string): Promise<void> {
  const repos = await createChromeRepositories();
  await repos.contacts.update(contactId, {
    connectionStatus: 'ACCEPTED',
    outreachMessageStatus: 'READY_TO_SEND',
  });
}

export async function revertContactStage(contactId: string): Promise<Contact> {
  const repos = await createChromeRepositories();
  const contacts = await repos.contacts.getAll();
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) throw new Error('Contact not found');

  const patch: Partial<Contact> = {};

  if (contact.followUp2Status !== 'NOT_SCHEDULED') {
    // Revert from Follow-up 2 back to Follow-up 1
    patch.followUp2Status = 'NOT_SCHEDULED';
    patch.followUp2ScheduledFor = undefined;
    patch.followUp2SentAt = undefined;
    patch.followUp1Status = 'READY_TO_SEND';
  } else if (
    contact.followUp1Status !== 'NOT_SCHEDULED' ||
    contact.outreachMessageStatus === 'SENT'
  ) {
    // Revert from Follow-up 1 back to Outreach (Ready to Send)
    patch.followUp1Status = 'NOT_SCHEDULED';
    patch.followUp1ScheduledFor = undefined;
    patch.followUp1SentAt = undefined;
    patch.outreachMessageStatus = 'READY_TO_SEND';
    patch.outreachMessageSentAt = undefined;
  }

  return repos.contacts.update(contactId, patch);
}

export async function runHousekeepingNow(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'HOUSEKEEPING_RUN' });
}

// ---------------------------------------------------------------------------
// Send Actions
// ---------------------------------------------------------------------------

export async function sendMessage(
  contactId: string,
  stage: Stage,
  messageOverride?: string,
): Promise<void> {
  // Assemble the message in the dashboard context so we can copy it to clipboard
  // (navigator.clipboard works reliably here but NOT in the background service worker)
  if (!messageOverride) {
    try {
      const { MessageAssemblyService } = await import('@refloop/core');
      const repos = await createChromeRepositories();
      const [contacts, jobs, settings] = await Promise.all([
        repos.contacts.getAll(),
        repos.jobs.getAll(),
        repos.settings.get(),
      ]);
      const contact = contacts.find((c) => c.id === contactId);
      const job = contact ? jobs.find((j) => j.id === contact.jobPostingId) : undefined;
      if (contact && job) {
        const assembler = new MessageAssemblyService();
        const assembled = assembler.assemble(stage, job, contact, settings);
        messageOverride = assembled.body;
      }
    } catch {
      // Assembly failed — background will assemble its own copy
    }
  }

  // Copy the assembled message to clipboard so the user can paste manually
  if (messageOverride) {
    try {
      await navigator.clipboard.writeText(messageOverride);
    } catch {
      // Clipboard copy is best-effort
    }
  }

  const result = await chrome.runtime.sendMessage({
    type: 'SEND_MESSAGE_REQUEST',
    payload: { contactId, stage, messageOverride },
  }) as { success: boolean; error?: string };
  if (!result.success) throw new Error(result.error ?? 'Send failed');
}

export async function cancelQueueItem(contactId: string, stage: Stage): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'CANCEL_QUEUE_ITEM',
    payload: { contactId, stage },
  });
}

export async function snoozeQueueItem(
  contactId: string,
  stage: Stage,
  snoozeUntil: string,
): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'SNOOZE_QUEUE_ITEM',
    payload: { contactId, stage, snoozeUntil },
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const repos = await createChromeRepositories();
  return repos.settings.update(patch);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(): Promise<void> {
  const result = await chrome.runtime.sendMessage({ type: 'SIGN_IN_REQUEST' }) as { success: boolean; error?: string };
  if (!result.success) throw new Error(result.error ?? 'Sign-in failed');
}

export async function signOut(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'SIGN_OUT_REQUEST' });
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

export async function exportData(): Promise<void> {
  const repos = await createChromeRepositories();
  const [jobs, contacts, settings, user] = await Promise.all([
    repos.jobs.getAll(),
    repos.contacts.getAll(),
    repos.settings.get(),
    repos.userAccount.get(),
  ]);

  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    user,
    jobs,
    contacts,
    settings,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const filename = `refloop-backup-${new Date().toISOString().split('T')[0]}.json`;

  // 1. Try chrome.downloads API via background worker
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' })) as
      | { success?: boolean; error?: string }
      | undefined;
    if (res?.success) {
      return;
    }
  } catch {
    // Fall back to client DOM blob download if background messaging fails
  }

  // 2. Client-side fallback via DOM Blob link
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<void> {
  const text = await file.text();
  let data: {
    version?: number;
    jobs?: JobPosting[];
    contacts?: Contact[];
    settings?: GlobalSettings;
    user?: UserAccount | null;
  };

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file format.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup data format.');
  }

  const hasJobs = Array.isArray(data.jobs);
  const hasContacts = Array.isArray(data.contacts);
  const hasSettings = data.settings && typeof data.settings === 'object';
  const hasUser = data.user && typeof data.user === 'object';

  if (!hasJobs && !hasContacts && !hasSettings && !hasUser) {
    throw new Error('Backup file does not contain valid RefLoop data.');
  }

  const repos = await createChromeRepositories();
  const { storageSet } = await import('@refloop/storage-chrome');

  if (hasJobs) {
    await storageSet('jobs:v1', data.jobs);
  }

  if (hasContacts) {
    await storageSet('contacts:v1', data.contacts);
  }

  if (hasSettings) {
    await repos.settings.update(data.settings!);
  }

  if (hasUser) {
    await repos.userAccount.set(data.user!);
  }

  // Re-initialize dashboard store state so UI reflects imported data immediately
  await initDashboard();
}

// ---------------------------------------------------------------------------
// Bootstrap — initialize stores on first load
// ---------------------------------------------------------------------------

export async function initDashboard(): Promise<void> {
  const { useJobsStore, useContactsStore, useSettingsStore, useAuthStore } = await import('../store/index.js');

  const repos = await createChromeRepositories();
  const [jobs, contacts, settings, user] = await Promise.all([
    repos.jobs.getAll(),
    repos.contacts.getAll(),
    repos.settings.get(),
    repos.userAccount.get(),
  ]);

  useJobsStore.getState().setJobs(jobs);
  useJobsStore.getState().setLoading(false);
  useContactsStore.getState().setContacts(contacts);
  useContactsStore.getState().setLoading(false);
  useSettingsStore.getState().setSettings(settings);
  useSettingsStore.getState().setLoading(false);
  useAuthStore.getState().setUser(user);
  useAuthStore.getState().setLoading(false);
}

// ---------------------------------------------------------------------------
// Gmail / Pro Mode
// ---------------------------------------------------------------------------

import type { GmailSyncState } from '@refloop/storage-chrome';

export async function connectGmail(): Promise<void> {
  const r = await chrome.runtime.sendMessage({ type: 'CONNECT_GMAIL' }) as { success: boolean; error?: string };
  if (!r.success) throw new Error(r.error ?? 'Failed to connect Gmail');
}

export async function disconnectGmail(): Promise<void> {
  const r = await chrome.runtime.sendMessage({ type: 'DISCONNECT_GMAIL' }) as { success: boolean; error?: string };
  if (!r.success) throw new Error(r.error ?? 'Failed to disconnect Gmail');
}

export async function gmailSyncNow(): Promise<GmailSyncState> {
  const r = await chrome.runtime.sendMessage({ type: 'GMAIL_SYNC_NOW' }) as { success: boolean; state?: GmailSyncState; error?: string };
  if (!r.success) throw new Error(r.error ?? 'Sync failed');
  return r.state!;
}

export async function getGmailSyncState(): Promise<GmailSyncState> {
  const r = await chrome.runtime.sendMessage({ type: 'GET_GMAIL_SYNC_STATE' }) as { success: boolean; state?: GmailSyncState; error?: string };
  if (!r.success) throw new Error(r.error ?? 'Failed to get sync state');
  return r.state!;
}


export async function resolveGmailAmbiguity(
  resolvedContactId: string,
  ambiguousContactIds: string[],
): Promise<void> {
  const r = await chrome.runtime.sendMessage({
    type: 'RESOLVE_GMAIL_AMBIGUITY',
    payload: { resolvedContactId, ambiguousContactIds },
  }) as { success: boolean; error?: string };
  if (!r.success) throw new Error(r.error ?? 'Failed to resolve ambiguity');
}

/**
 * Dismiss an ambiguous Gmail match — reverts all REVIEW_REQUIRED contacts to PENDING
 * and permanently marks the Gmail message as processed (no match chosen).
 */
export async function dismissGmailAmbiguity(
  ambiguousContactIds: string[],
  gmailMessageId: string,
): Promise<void> {
  const r = await chrome.runtime.sendMessage({
    type: 'DISMISS_GMAIL_AMBIGUITY',
    payload: { ambiguousContactIds, gmailMessageId },
  }) as { success: boolean; error?: string };
  if (!r.success) throw new Error(r.error ?? 'Failed to dismiss ambiguity');
}

/**
 * Clear the entire Gmail sync cache (processed IDs + unmatched acceptance cache)
 * and run a fresh sync from scratch.
 *
 * Use this when a contact was added after their acceptance email was already seen
 * (e.g. the Indu scenario). Returns the resulting sync state.
 */
export async function resetGmailSyncAndResync(): Promise<GmailSyncState> {
  const r = await chrome.runtime.sendMessage({ type: 'GMAIL_RESET_AND_RESYNC' }) as {
    success: boolean;
    state?: GmailSyncState;
    error?: string;
  };
  if (!r.success) throw new Error(r.error ?? 'Reset and re-sync failed');
  return r.state!;
}
