// =============================================================================
// RefLoop — Gmail LinkedIn Acceptance Matcher
// Pure business logic — no Chrome APIs, fully unit-testable.
// Detects LinkedIn "accepted your invitation" emails from Gmail metadata
// and matches the extracted name against stored PENDING contacts.
// =============================================================================

import type { Contact } from '../domain/models.js';

// ---------------------------------------------------------------------------
// Sender detection
// ---------------------------------------------------------------------------

/**
 * LinkedIn sends notification emails from domains like:
 *   notifications@linkedin.com
 *   inmail.linkedin.com
 *   e.linkedin.com
 * We match any "From" header that contains a linkedin.com domain.
 */
const LINKEDIN_SENDER_PATTERNS: RegExp[] = [/linkedin\.com/i];

export function isLinkedInSender(from: string): boolean {
  return LINKEDIN_SENDER_PATTERNS.some((re) => re.test(from));
}

// ---------------------------------------------------------------------------
// Acceptance subject detection + name extraction
// ---------------------------------------------------------------------------

/**
 * Confirmed real-world LinkedIn acceptance email subject:
 *   "Sushant accepted your invitation, explore their network"
 *
 * The capture group extracts the person's name as LinkedIn sent it —
 * this may be a first name only, or a full name. We handle both.
 */
const ACCEPTANCE_SUBJECT_PATTERNS: RegExp[] = [
  /^(.+?)\s+accepted your invitation/i,
];

export interface MatchResult {
  isLinkedInAcceptance: boolean;
  /** The name extracted from the subject, e.g. "Sushant" or "John Doe". Null if not an acceptance. */
  extractedName: string | null;
}

/**
 * Determines if a Gmail message (identified by From + Subject headers) is a
 * LinkedIn connection-acceptance notification, and extracts the acceptor's name.
 */
export function parseLinkedInAcceptanceEmail(from: string, subject: string): MatchResult {
  if (!isLinkedInSender(from)) {
    return { isLinkedInAcceptance: false, extractedName: null };
  }

  for (const pattern of ACCEPTANCE_SUBJECT_PATTERNS) {
    const match = pattern.exec(subject.trim());
    if (match?.[1]) {
      return { isLinkedInAcceptance: true, extractedName: match[1].trim() };
    }
  }

  return { isLinkedInAcceptance: false, extractedName: null };
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/** Lowercase, trim, collapse consecutive whitespace. */
function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Contact matching
// ---------------------------------------------------------------------------

/**
 * Given a name extracted from a LinkedIn acceptance email, find all stored
 * PENDING LinkedIn contacts that plausibly match.
 *
 * Matching priority:
 * 1. fullNameRaw (full name stored at contact-creation time from LinkedIn)
 * 2. firstName only (fallback for when the email subject contains first name only)
 *
 * Returns all matches — the caller decides:
 *   0 matches → no stored contact for this person
 *   1 match   → exact → mark ACCEPTED
 *   2+ matches → ambiguous → mark REVIEW_REQUIRED
 */
export function findMatchingContacts(extractedName: string, contacts: Contact[]): Contact[] {
  const normExtracted = normalize(extractedName);

  const pendingLinkedIn = contacts.filter(
    (c) => c.channel === 'LINKEDIN' && c.connectionStatus === 'PENDING',
  );

  // First pass: match against fullNameRaw
  const fullNameMatches = pendingLinkedIn.filter((c) => {
    if (!c.fullNameRaw) return false;
    return normalize(c.fullNameRaw) === normExtracted;
  });

  if (fullNameMatches.length > 0) return fullNameMatches;

  // Second pass: match against firstName (handles "Sushant" → firstName only)
  const firstNameMatches = pendingLinkedIn.filter(
    (c) => normalize(c.firstName) === normExtracted,
  );

  return firstNameMatches;
}
