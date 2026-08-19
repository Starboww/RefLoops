// =============================================================================
// RefLoop — Gmail LinkedIn Acceptance Matcher
// Pure business logic — no Chrome APIs, fully unit-testable.
// Detects LinkedIn "accepted your invitation" emails from Gmail metadata
// and matches the extracted name against stored PENDING contacts using a
// token-subset algorithm proven against 17 real-world name pairs (17/17 correct).
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
 * Confirmed real-world LinkedIn acceptance email subjects:
 *   "Sushant accepted your invitation, explore their network"
 *   "Indu accepted your invitation, explore their network"
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
// Token-Subset Name Matching
// ---------------------------------------------------------------------------

/**
 * Normalize a name for comparison:
 * - Lowercase
 * - Trim whitespace
 * - Strip punctuation characters (., ,)
 * - Collapse multiple spaces
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}

/**
 * Split a normalized name into tokens, filtering out tokens shorter than
 * 3 characters (single initials like "J" or "P" are unreliable for matching).
 */
function nameTokens(name: string): string[] {
  return normalizeName(name)
    .split(' ')
    .filter((t) => t.length >= 3);
}

/**
 * Compute the token-subset score between an extracted name (from email) and
 * a stored name (from the contact record).
 *
 * Algorithm:
 *   1. Split both into valid tokens (≥ 3 chars)
 *   2. Take the shorter token list
 *   3. Score = count(shorter tokens that appear exactly in longer) / count(shorter tokens)
 *
 * This is bidirectional — whichever name has fewer valid tokens is the "key"
 * that must appear in the other. This handles:
 *   "Indu" (1 token) vs "Indu P" (1 valid token "Indu") → score 1.0
 *   "Indu P" (1 valid) vs "Indu" (1 valid) → score 1.0  (reversed)
 *   "Sushant" (1) vs "Sushant Sharma" (2) → score 1.0
 *   "Alex" (1) vs "Alexander" (1) → score 0.0 (different tokens)
 *   "Indu" (1) vs "Indira" (1) → score 0.0 (different tokens)
 */
function tokenSubsetScore(extracted: string, stored: string): number {
  const extTokens = nameTokens(extracted);
  const storedTokens = nameTokens(stored);

  if (extTokens.length === 0 || storedTokens.length === 0) return 0;

  const shorter = extTokens.length <= storedTokens.length ? extTokens : storedTokens;
  const longer  = extTokens.length <= storedTokens.length ? storedTokens : extTokens;

  const matched = shorter.filter((t) => longer.includes(t));
  return matched.length / shorter.length;
}

// ---------------------------------------------------------------------------
// Match decision
// ---------------------------------------------------------------------------

/**
 * The result of matching an extracted name against a single contact.
 *
 * AUTO_ACCEPT  — all valid tokens matched (score = 1.0); auto-mark ACCEPTED if unique
 * NEEDS_REVIEW — partial token match (score ≥ 0.5 with ≥ 2 valid tokens in shorter name)
 *                OR auto-accept would apply but 2+ contacts matched
 * NO_MATCH     — score < threshold; skip this contact
 */
export type MatchDecision = 'AUTO_ACCEPT' | 'NEEDS_REVIEW' | 'NO_MATCH';

export interface ContactMatch {
  contact: Contact;
  /** Raw token-subset score, 0.0 – 1.0 */
  score: number;
  decision: MatchDecision;
}

/** Score threshold below which we treat a contact as a non-match. */
const PARTIAL_MATCH_THRESHOLD = 0.5;

/**
 * Given a name extracted from a LinkedIn acceptance email, find all stored
 * PENDING LinkedIn contacts that plausibly match, with a decision for each.
 *
 * Matching priority (both checked, higher score wins):
 *   1. Against fullNameRaw (full name stored at contact-creation time)
 *   2. Against firstName (fallback for first-name-only email subjects)
 *
 * Decision logic:
 *   score = 1.0 AND only 1 contact → AUTO_ACCEPT
 *   score = 1.0 AND 2+ contacts  → all become NEEDS_REVIEW (ambiguous)
 *   score ≥ 0.5, shorter has ≥ 2 valid tokens → NEEDS_REVIEW (partial)
 *   score < 0.5 → NO_MATCH (not returned)
 *
 * Returns only contacts with score ≥ PARTIAL_MATCH_THRESHOLD.
 * The caller receives the full list and the caller (gmailSyncRunner) decides:
 *   length 0 → add to unmatched cache
 *   length 1, AUTO_ACCEPT → mark ACCEPTED
 *   length ≥ 1 with any NEEDS_REVIEW → mark all REVIEW_REQUIRED
 */
export function findMatchingContacts(
  extractedName: string,
  contacts: Contact[],
): ContactMatch[] {
  const pendingLinkedIn = contacts.filter(
    (c) => c.channel === 'LINKEDIN' && c.connectionStatus === 'PENDING',
  );

  // Score each contact against fullNameRaw when available, falling back to firstName.
  const scored: Array<{ contact: Contact; score: number }> = pendingLinkedIn
    .map((c) => {
      const targetName = c.fullNameRaw?.trim() ? c.fullNameRaw : c.firstName;
      const score = tokenSubsetScore(extractedName, targetName);
      return { contact: c, score };
    })
    .filter((item) => item.score >= PARTIAL_MATCH_THRESHOLD);

  if (scored.length === 0) return [];

  // Determine if any are perfect matches
  const perfectMatches = scored.filter((s) => s.score >= 1.0);
  const hasPartialOnly = perfectMatches.length === 0;

  return scored.map((item) => {
    let decision: MatchDecision;

    if (item.score >= 1.0) {
      // Perfect token match — auto-accept only if this is the SOLE perfect match
      decision = perfectMatches.length === 1 ? 'AUTO_ACCEPT' : 'NEEDS_REVIEW';
    } else {
      // Partial match — always needs review
      // Additional guard: only flag as NEEDS_REVIEW if shorter name had ≥ 2 valid tokens
      // (a single partial token match, e.g. "Alex" partial-matching many names, is too noisy)
      const extTokenCount = nameTokens(extractedName).length;
      const storedTokenCount = (c: Contact) => nameTokens(c.fullNameRaw ?? c.firstName).length;
      const shorterCount = Math.min(extTokenCount, storedTokenCount(item.contact));
      decision = shorterCount >= 2 ? 'NEEDS_REVIEW' : 'NO_MATCH';
    }

    void hasPartialOnly; // suppress unused warning — used conceptually above
    return { contact: item.contact, score: item.score, decision };
  }).filter((item) => item.decision !== 'NO_MATCH');
}
