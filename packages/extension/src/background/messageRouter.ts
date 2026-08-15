// =============================================================================
// RefLoop — Message Router
// Technical Design §3.5: single switch exhaustively routing all typed messages.
// =============================================================================

import type { ChromeRepositories } from '@refloop/storage-chrome';
import type { ExtensionMessage } from '@refloop/core';
import { isExtensionMessage } from '@refloop/core';
import { signIn, signOut } from '../auth/googleAuth.js';
import { connectGmail, disconnectGmail } from '../auth/gmailAuth.js';
import { executeSend } from './sendActionRunner.js';
import { runHousekeeping } from './housekeepingRunner.js';
import { syncLinkedInAcceptances } from './gmailSyncRunner.js';

export function messageRouter(repos: ChromeRepositories): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isExtensionMessage(message)) return false;

    handleMessage(message, repos, sendResponse);
    return true;
  });
}

async function handleMessage(
  message: ExtensionMessage,
  repos: ChromeRepositories,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    switch (message.type) {
      case 'ADD_JOB_REQUEST': {
        const job = await repos.jobs.create({
          ...message.payload,
          dateAdded: new Date().toISOString(),
          status: 'ACTIVE',
          referralMessageTemplate: '',
        });
        sendResponse({ success: true, job });
        break;
      }

      case 'ADD_LINKEDIN_CONTACT_REQUEST': {
        const contact = await repos.contacts.create({
          ...message.payload,
          channel: 'LINKEDIN',
          connectionStatus: 'PENDING',
          outreachMessageStatus: 'QUEUED',
          followUp1Status: 'NOT_SCHEDULED',
          followUp2Status: 'NOT_SCHEDULED',
          connectionRequestSentAt: message.payload.connectionRequestSentAt ?? new Date().toISOString(),
        });
        sendResponse({ success: true, contact });
        break;
      }

      case 'ADD_EMAIL_CONTACT_REQUEST': {
        const contact = await repos.contacts.create({
          ...message.payload,
          channel: 'EMAIL',
          outreachMessageStatus: 'READY_TO_SEND',
          followUp1Status: 'NOT_SCHEDULED',
          followUp2Status: 'NOT_SCHEDULED',
          emailAddedAt: new Date().toISOString(),
        });
        sendResponse({ success: true, contact });
        break;
      }

      case 'SEND_MESSAGE_REQUEST': {
        const result = await executeSend(
          message.payload.contactId,
          message.payload.stage,
          message.payload.messageOverride,
        );
        sendResponse(result);
        break;
      }

      case 'CANCEL_QUEUE_ITEM': {
        const { contactId, stage } = message.payload;
        const patch: Record<string, string> = {};
        if (stage === 'OUTREACH') patch['outreachMessageStatus'] = 'CANCELLED_BY_USER';
        else if (stage === 'FU1') patch['followUp1Status'] = 'CANCELLED_BY_USER';
        else if (stage === 'FU2') patch['followUp2Status'] = 'CANCELLED_BY_USER';
        await repos.contacts.update(contactId, patch);
        sendResponse({ success: true });
        break;
      }

      case 'SNOOZE_QUEUE_ITEM': {
        const { contactId, stage, snoozeUntil } = message.payload;
        const patch: Record<string, string> = {};
        if (stage === 'FU1') {
          patch['followUp1ScheduledFor'] = snoozeUntil;
          patch['followUp1Status'] = 'SCHEDULED';
        } else if (stage === 'FU2') {
          patch['followUp2ScheduledFor'] = snoozeUntil;
          patch['followUp2Status'] = 'SCHEDULED';
        }
        await repos.contacts.update(contactId, patch);
        sendResponse({ success: true });
        break;
      }

      case 'SIGN_IN_REQUEST': {
        const user = await signIn();
        sendResponse({ success: true, user });
        break;
      }

      case 'SIGN_OUT_REQUEST': {
        await signOut();
        sendResponse({ success: true });
        break;
      }

      case 'HOUSEKEEPING_RUN': {
        await runHousekeeping();
        sendResponse({ success: true });
        break;
      }

      case 'OPEN_DASHBOARD': {
        await chrome.tabs.create({
          url: chrome.runtime.getURL('src/dashboard/index.html'),
        });
        sendResponse({ success: true });
        break;
      }

      case 'EXPORT_DATA': {
        const [jobs, contacts, settings, user] = await Promise.all([
          repos.jobs.getAll(),
          repos.contacts.getAll(),
          repos.settings.get(),
          repos.userAccount.get(),
        ]);
        const exportData = {
          version: 1,
          exportedAt: new Date().toISOString(),
          user,
          jobs,
          contacts,
          settings,
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        await chrome.downloads.download({
          url,
          filename: `refloop-backup-${new Date().toISOString().split('T')[0]}.json`,
          saveAs: false,
        });
        sendResponse({ success: true });
        break;
      }

      case 'CONNECT_GMAIL': {
        await connectGmail();
        sendResponse({ success: true });
        break;
      }

      case 'DISCONNECT_GMAIL': {
        await disconnectGmail();
        sendResponse({ success: true });
        break;
      }

      case 'GMAIL_SYNC_NOW': {
        await syncLinkedInAcceptances();
        const syncState = await repos.gmailSync.getSyncState();
        sendResponse({ success: true, state: syncState });
        break;
      }

      case 'GET_GMAIL_SYNC_STATE': {
        const state = await repos.gmailSync.getSyncState();
        sendResponse({ success: true, state });
        break;
      }

      case 'RESOLVE_GMAIL_AMBIGUITY': {
        const { resolvedContactId, ambiguousContactIds } = message.payload;
        // Mark the chosen contact as ACCEPTED
        await repos.contacts.update(resolvedContactId, {
          connectionStatus: 'ACCEPTED',
          connectionAcceptedAt: new Date().toISOString(),
        });
        // Revert the other ambiguous contacts back to PENDING
        for (const id of ambiguousContactIds) {
          if (id !== resolvedContactId) {
            await repos.contacts.update(id, {
              connectionStatus: 'PENDING',
              acceptanceGmailMessageId: undefined,
            });
          }
        }
        sendResponse({ success: true });
        break;
      }

      default: {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    }
  } catch (err) {
    console.error('[RefLoop] Message handler error:', err);
    sendResponse({ success: false, error: String(err) });
  }
}
