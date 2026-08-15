// =============================================================================
// RefLoop — Typed Extension Message Union (Command pattern)
// Technical Design §3.5
// ALL inter-context messages must use this union. The background message router
// switches exhaustively on message.type.
// =============================================================================

import type {
  Contact,
  JobPosting,
  NewJobInput,
  NewLinkedInContactInput,
  NewEmailContactInput,
  Stage,
} from '../domain/models.js';

// ---------------------------------------------------------------------------
// Content Script → Background
// ---------------------------------------------------------------------------

export interface AddJobRequestMessage {
  type: 'ADD_JOB_REQUEST';
  payload: NewJobInput;
}

export interface AddLinkedInContactRequestMessage {
  type: 'ADD_LINKEDIN_CONTACT_REQUEST';
  payload: NewLinkedInContactInput;
}

export interface AddEmailContactRequestMessage {
  type: 'ADD_EMAIL_CONTACT_REQUEST';
  payload: NewEmailContactInput;
}

// ---------------------------------------------------------------------------
// Dashboard → Background
// ---------------------------------------------------------------------------

export interface SendMessageRequestMessage {
  type: 'SEND_MESSAGE_REQUEST';
  payload: {
    contactId: string;
    stage: Stage;
    messageOverride?: string;
  };
}

export interface CancelQueueItemMessage {
  type: 'CANCEL_QUEUE_ITEM';
  payload: {
    contactId: string;
    stage: Stage;
  };
}

export interface SnoozeQueueItemMessage {
  type: 'SNOOZE_QUEUE_ITEM';
  payload: {
    contactId: string;
    stage: Stage;
    snoozeUntil: string; // ISO 8601
  };
}

export interface SignInRequestMessage {
  type: 'SIGN_IN_REQUEST';
}

export interface SignOutRequestMessage {
  type: 'SIGN_OUT_REQUEST';
}

export interface OpenDashboardMessage {
  type: 'OPEN_DASHBOARD';
}

export interface HousekeepingRunMessage {
  type: 'HOUSEKEEPING_RUN';
}

export interface ExportDataMessage {
  type: 'EXPORT_DATA';
}

// ---------------------------------------------------------------------------
// Gmail / Pro Mode — Dashboard → Background
// ---------------------------------------------------------------------------

export interface ConnectGmailMessage {
  type: 'CONNECT_GMAIL';
}

export interface DisconnectGmailMessage {
  type: 'DISCONNECT_GMAIL';
}

export interface GmailSyncNowMessage {
  type: 'GMAIL_SYNC_NOW';
}

export interface GetGmailSyncStateMessage {
  type: 'GET_GMAIL_SYNC_STATE';
}

export interface ResolveGmailAmbiguityMessage {
  type: 'RESOLVE_GMAIL_AMBIGUITY';
  payload: {
    /** The contact the user identified as the correct match — set to ACCEPTED */
    resolvedContactId: string;
    /** All other contacts that were REVIEW_REQUIRED for the same email — reverted to PENDING */
    ambiguousContactIds: string[];
  };
}

// ---------------------------------------------------------------------------
// Background → Content Script
// ---------------------------------------------------------------------------

export interface PasteAndSendMessage {
  type: 'PASTE_AND_SEND';
  payload: {
    message: string;
    contactId: string;
    stage: Stage;
  };
}

// ---------------------------------------------------------------------------
// Content Script → Background (responses)
// ---------------------------------------------------------------------------

export interface SendConfirmedMessage {
  type: 'SEND_CONFIRMED';
  payload: {
    contactId: string;
    stage: Stage;
    sentAt: string; // ISO 8601
  };
}

export interface SendFailedMessage {
  type: 'SEND_FAILED';
  payload: {
    contactId: string;
    stage: Stage;
    error: string;
  };
}

// ---------------------------------------------------------------------------
// Background → Dashboard (via storage.onChanged — not direct messages)
// These are emitted as storage change events, not chrome.runtime.sendMessage
// ---------------------------------------------------------------------------

export interface ContactUpdatedMessage {
  type: 'CONTACT_UPDATED';
  payload: Contact;
}

export interface JobUpdatedMessage {
  type: 'JOB_UPDATED';
  payload: JobPosting;
}

// ---------------------------------------------------------------------------
// Union type — the complete set
// ---------------------------------------------------------------------------

export type ExtensionMessage =
  | AddJobRequestMessage
  | AddLinkedInContactRequestMessage
  | AddEmailContactRequestMessage
  | SendMessageRequestMessage
  | CancelQueueItemMessage
  | SnoozeQueueItemMessage
  | SignInRequestMessage
  | SignOutRequestMessage
  | OpenDashboardMessage
  | HousekeepingRunMessage
  | ExportDataMessage
  | PasteAndSendMessage
  | SendConfirmedMessage
  | SendFailedMessage
  | ContactUpdatedMessage
  | JobUpdatedMessage
  | ConnectGmailMessage
  | DisconnectGmailMessage
  | GmailSyncNowMessage
  | GetGmailSyncStateMessage
  | ResolveGmailAmbiguityMessage;

export type MessageType = ExtensionMessage['type'];

/** Type guard — narrows an unknown message to ExtensionMessage */
export function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as Record<string, unknown>)['type'] === 'string'
  );
}
