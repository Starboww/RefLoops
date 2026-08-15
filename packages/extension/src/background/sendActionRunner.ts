// =============================================================================
// RefLoop — Send Action Runner
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';
import { MessageAssemblyService, SystemClock, HousekeepingService } from '@refloop/core';
import type { Contact, Stage } from '@refloop/core';

const MAX_MAILTO_BODY_LENGTH = 1800;

export async function executeSend(
  contactId: string,
  stage: Stage,
  messageOverride?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const repos = await createChromeRepositories();
    const [allContacts, allJobs, settings] = await Promise.all([
      repos.contacts.getAll(),
      repos.jobs.getAll(),
      repos.settings.get(),
    ]);

    const contact = allContacts.find((c) => c.id === contactId);
    if (!contact) return { success: false, error: 'Contact not found' };

    const job = allJobs.find((j) => j.id === contact.jobPostingId);
    if (!job) return { success: false, error: 'Job not found' };

    const assembler = new MessageAssemblyService();
    const assembled = assembler.assemble(stage, job, contact, settings, messageOverride);

    let sentAt: string;

    if (contact.channel === 'LINKEDIN') {
      const result = await sendLinkedIn(contact, assembled.body);
      if (!result.success) {
        return { success: false, error: result.error ?? 'LinkedIn send failed' };
      }
      sentAt = result.sentAt ?? new Date().toISOString();
    } else {
      const result = await sendEmail(contact, assembled.subject ?? '', assembled.body);
      if (!result.success) return result;
      sentAt = new Date().toISOString();
    }

    await markStageSent(contactId, stage, sentAt, repos);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendLinkedIn(
  contact: Contact,
  message: string,
): Promise<{ success: boolean; sentAt?: string; error?: string }> {
  if (!contact.linkedinProfileUrl) {
    return { success: false, error: 'No LinkedIn profile URL for contact' };
  }

  const existingTabs = await chrome.tabs.query({ url: `${contact.linkedinProfileUrl}*` });
  let tab: chrome.tabs.Tab;

  if (existingTabs[0]?.id) {
    tab = existingTabs[0];
    await chrome.tabs.update(tab.id!, { active: true });
  } else {
    tab = await chrome.tabs.create({ url: contact.linkedinProfileUrl });
  }

  await waitForTabLoad(tab.id!);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Send timeout — LinkedIn tab did not respond' });
    }, 30_000);

    chrome.tabs.sendMessage(
      tab.id!,
      {
        type: 'PASTE_AND_SEND',
        payload: { message, contactId: contact.id, stage: 'OUTREACH' },
      },
      (response: { success: boolean; error?: string } | undefined) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message ?? 'Tab message error';
          resolve({ success: false, error: err });
          return;
        }
        if (response?.success) {
          resolve({ success: true, sentAt: new Date().toISOString() });
        } else {
          const err = response?.error ?? 'Send failed';
          resolve({ success: false, error: err });
        }
      },
    );
  });
}

async function sendEmail(
  contact: Contact,
  subject: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  if (!contact.emailAddress) {
    return { success: false, error: 'No email address for contact' };
  }

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const mailtoUrl = `mailto:${contact.emailAddress}?subject=${encodedSubject}&body=${encodedBody}`;

  if (mailtoUrl.length > MAX_MAILTO_BODY_LENGTH) {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      const shortMailto = `mailto:${contact.emailAddress}?subject=${encodedSubject}`;
      await chrome.tabs.create({ url: shortMailto });
      return { success: true };
    } catch {
      return { success: false, error: 'Could not copy to clipboard' };
    }
  }

  await chrome.tabs.create({ url: mailtoUrl });
  return { success: true };
}

async function markStageSent(
  contactId: string,
  stage: Stage,
  sentAt: string,
  repos: Awaited<ReturnType<typeof createChromeRepositories>>,
): Promise<void> {
  const contact = (await repos.contacts.getAll()).find((c) => c.id === contactId);
  if (!contact) return;

  const sentDate = new Date(sentAt);

  if (stage === 'OUTREACH') {
    await repos.contacts.update(contactId, {
      outreachMessageStatus: 'SENT',
      outreachMessageSentAt: sentAt,
    });
  } else if (stage === 'FU1') {
    await repos.contacts.update(contactId, {
      followUp1Status: 'SENT',
      followUp1SentAt: sentAt,
    });
  } else if (stage === 'FU2') {
    await repos.contacts.update(contactId, {
      followUp2Status: 'SENT',
      followUp2SentAt: sentAt,
    });
  }

  if (stage !== 'FU2') {
    const clock = new SystemClock();
    const hk = new HousekeepingService(repos.jobs, repos.contacts, repos.settings, clock);
    await hk.scheduleNextFollowUp(
      contact,
      stage === 'OUTREACH' ? 'OUTREACH' : 'FU1',
      sentDate,
    );
  }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15_000);
  });
}
