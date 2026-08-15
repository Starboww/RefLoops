// =============================================================================
// RefLoop — Gmail API Client
// Thin wrapper around the Gmail REST API — metadata only, NEVER fetches body.
// All calls run in the background service worker context.
// =============================================================================

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ---------------------------------------------------------------------------
// Typed error — thrown on 401 so the caller can handle token expiry
// ---------------------------------------------------------------------------

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

// ---------------------------------------------------------------------------
// Response types (partial — only fields we use)
// ---------------------------------------------------------------------------

interface GmailMessagesListResponse {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
}

interface GmailMessageResponse {
  id: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GmailMessageMetadata {
  id: string;
  from: string;
  subject: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    throw new GmailAuthError('Gmail token expired or revoked');
  }

  if (!res.ok) {
    throw new Error(`Gmail API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

function extractHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string {
  if (!headers) return '';
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the most recent Gmail message IDs.
 * Note: The `q` search parameter is NOT supported with gmail.metadata scope,
 * so we fetch broadly and filter locally.
 */
export async function listMessageIds(token: string, maxResults = 100): Promise<string[]> {
  const data = await gmailFetch<GmailMessagesListResponse>(
    token,
    `/messages?maxResults=${maxResults}`,
  );
  return (data.messages ?? []).map((m) => m.id);
}

/**
 * Fetch only the From, Subject, and Date headers for a single message.
 * Never requests body, raw, or attachments.
 */
export async function getMessageMetadata(
  token: string,
  messageId: string,
): Promise<GmailMessageMetadata> {
  const data = await gmailFetch<GmailMessageResponse>(
    token,
    `/messages/${messageId}?format=METADATA&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
  );

  const headers = data.payload?.headers;
  return {
    id: data.id,
    from: extractHeader(headers, 'From'),
    subject: extractHeader(headers, 'Subject'),
    date: extractHeader(headers, 'Date'),
  };
}
