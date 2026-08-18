// =============================================================================
// RefLoop — URL & Contact Deduplication Utilities
// =============================================================================

import type { Contact, ContactChannel } from './models.js';

/**
 * Normalizes a LinkedIn profile URL to a canonical vanity path (e.g. "/in/johndoe").
 * Strips protocol, subdomains (e.g. www, in, uk), query parameters, trailing slashes, and anchors.
 */
export function normalizeLinkedInProfileUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl) return '';

  let str = rawUrl.trim();
  if (!str) return '';

  try {
    // If it starts with /in/ or in/
    if (str.startsWith('/in/') || str.startsWith('in/')) {
      const pathOnly = str.startsWith('/') ? str : `/${str}`;
      return pathOnly.split('?')[0]!.split('#')[0]!.replace(/\/+$/, '').toLowerCase();
    }

    // Prepend https:// if not present
    let urlToParse = str;
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = `https://${urlToParse}`;
    }

    const url = new URL(urlToParse);
    let pathname = url.pathname.toLowerCase().trim();
    // Remove trailing slashes
    pathname = pathname.replace(/\/+$/, '');
    // Standardize leading slash
    if (!pathname.startsWith('/')) {
      pathname = `/${pathname}`;
    }
    return pathname;
  } catch {
    // Fallback regex / string manipulation
    let cleaned = str.toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\//i, '');
    cleaned = cleaned.replace(/^[a-z0-9-]+\.linkedin\.com/i, '');
    cleaned = cleaned.replace(/^linkedin\.com/i, '');
    cleaned = cleaned.split('?')[0]!.split('#')[0]!;
    cleaned = cleaned.replace(/\/+$/, '');
    if (!cleaned.startsWith('/')) {
      cleaned = `/${cleaned}`;
    }
    return cleaned;
  }
}

/**
 * Normalizes an email address for comparison.
 */
export function normalizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Checks if a contact already exists for a specific job posting.
 */
export function isDuplicateContact(
  existingContacts: Contact[],
  target: {
    jobPostingId: string;
    channel: ContactChannel;
    linkedinProfileUrl?: string | undefined;
    emailAddress?: string | undefined;
  },
): boolean {
  const jobContacts = existingContacts.filter(
    (c) => c.jobPostingId === target.jobPostingId && !c.removedAt,
  );

  if (target.channel === 'LINKEDIN') {
    const targetNormalized = normalizeLinkedInProfileUrl(target.linkedinProfileUrl);
    if (!targetNormalized) return false;

    return jobContacts.some(
      (c) => c.channel === 'LINKEDIN' && normalizeLinkedInProfileUrl(c.linkedinProfileUrl) === targetNormalized,
    );
  }

  if (target.channel === 'EMAIL') {
    const targetNormalized = normalizeEmail(target.emailAddress);
    if (!targetNormalized) return false;

    return jobContacts.some(
      (c) => c.channel === 'EMAIL' && normalizeEmail(c.emailAddress) === targetNormalized,
    );
  }

  return false;
}
