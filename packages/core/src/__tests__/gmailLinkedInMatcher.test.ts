import { describe, it, expect } from 'vitest';
import {
  parseLinkedInAcceptanceEmail,
  findMatchingContacts,
  isLinkedInSender,
} from '../services/gmailLinkedInMatcher.js';
import type { Contact } from '../domain/models.js';

describe('isLinkedInSender', () => {
  it('identifies LinkedIn senders correctly', () => {
    expect(isLinkedInSender('Indu P via LinkedIn <invitations@linkedin.com>')).toBe(true);
    expect(isLinkedInSender('notifications@e.linkedin.com')).toBe(true);
    expect(isLinkedInSender('inmail.linkedin.com')).toBe(true);
    expect(isLinkedInSender('promotions@google.com')).toBe(false);
    expect(isLinkedInSender('random@example.com')).toBe(false);
  });
});

describe('parseLinkedInAcceptanceEmail', () => {
  it('extracts name from LinkedIn acceptance emails', () => {
    const from = 'Indu P via LinkedIn <invitations@linkedin.com>';
    const subject = 'Indu accepted your invitation, explore their network';
    const result = parseLinkedInAcceptanceEmail(from, subject);

    expect(result.isLinkedInAcceptance).toBe(true);
    expect(result.extractedName).toBe('Indu');
  });

  it('extracts full names if present in subject', () => {
    const from = 'Indu P via LinkedIn <invitations@linkedin.com>';
    const subject = 'Indu Priya Sharma accepted your invitation, explore their network';
    const result = parseLinkedInAcceptanceEmail(from, subject);

    expect(result.isLinkedInAcceptance).toBe(true);
    expect(result.extractedName).toBe('Indu Priya Sharma');
  });

  it('rejects non-LinkedIn emails', () => {
    const from = 'Someone <someone@gmail.com>';
    const subject = 'Indu accepted your invitation, explore their network';
    const result = parseLinkedInAcceptanceEmail(from, subject);

    expect(result.isLinkedInAcceptance).toBe(false);
    expect(result.extractedName).toBeNull();
  });

  it('rejects other LinkedIn emails (not invitations)', () => {
    const from = 'LinkedIn <updates@linkedin.com>';
    const subject = 'You have 3 new job recommendations';
    const result = parseLinkedInAcceptanceEmail(from, subject);

    expect(result.isLinkedInAcceptance).toBe(false);
    expect(result.extractedName).toBeNull();
  });
});

describe('findMatchingContacts - Token Subset Matching', () => {
  const createContact = (
    id: string,
    firstName: string,
    fullNameRaw?: string,
    channel: 'LINKEDIN' | 'EMAIL' = 'LINKEDIN',
    connectionStatus: 'PENDING' | 'ACCEPTED' | 'REVIEW_REQUIRED' = 'PENDING',
  ): Contact => ({
    id,
    jobPostingId: 'job-1',
    channel,
    firstName,
    fullNameRaw,
    connectionStatus,
    outreachMessageStatus: 'QUEUED',
    followUp1Status: 'NOT_SCHEDULED',
    followUp2Status: 'NOT_SCHEDULED',
  });

  it('matches Indu against stored contact Indu P with score 1.0 (Auto-Accept)', () => {
    const contacts = [createContact('c-1', 'Indu', 'Indu P')];
    const matches = findMatchingContacts('Indu', contacts);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.contact.id).toBe('c-1');
    expect(matches[0]?.score).toBe(1.0);
    expect(matches[0]?.decision).toBe('AUTO_ACCEPT');
  });

  it('matches reversed: extracted name Indu P against stored contact Indu', () => {
    const contacts = [createContact('c-1', 'Indu')];
    const matches = findMatchingContacts('Indu P', contacts);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.contact.id).toBe('c-1');
    expect(matches[0]?.decision).toBe('AUTO_ACCEPT');
  });

  it('matches Sushant against Sushant Sharma (Auto-Accept)', () => {
    const contacts = [createContact('c-1', 'Sushant', 'Sushant Sharma')];
    const matches = findMatchingContacts('Sushant', contacts);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.contact.id).toBe('c-1');
    expect(matches[0]?.decision).toBe('AUTO_ACCEPT');
  });

  it('flags 2 contacts with same name as NEEDS_REVIEW (Ambiguity)', () => {
    const contacts = [
      createContact('c-1', 'Alex', 'Alex Johnson'),
      createContact('c-2', 'Alex', 'Alex Chen'),
    ];
    const matches = findMatchingContacts('Alex', contacts);

    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.decision === 'NEEDS_REVIEW')).toBe(true);
  });

  it('flags partial matches (e.g. Alex Wong vs Alex Johnson) as NEEDS_REVIEW', () => {
    const contacts = [createContact('c-1', 'Alex', 'Alex Johnson')];
    const matches = findMatchingContacts('Alex Wong', contacts);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.score).toBe(0.5);
    expect(matches[0]?.decision).toBe('NEEDS_REVIEW');
  });

  it('does NOT match false-prefix names (Indu vs Indira)', () => {
    const contacts = [createContact('c-1', 'Indira', 'Indira Prasad')];
    const matches = findMatchingContacts('Indu', contacts);

    expect(matches).toHaveLength(0);
  });

  it('does NOT match false-prefix names (Raj vs Rajesh)', () => {
    const contacts = [createContact('c-1', 'Rajesh', 'Rajesh Kumar')];
    const matches = findMatchingContacts('Raj', contacts);

    expect(matches).toHaveLength(0);
  });

  it('does NOT match Alex vs Alexander', () => {
    const contacts = [createContact('c-1', 'Alexander', 'Alexander Smith')];
    const matches = findMatchingContacts('Alex', contacts);

    expect(matches).toHaveLength(0);
  });

  it('ignores non-PENDING or non-LINKEDIN contacts', () => {
    const contacts = [
      createContact('c-1', 'Indu', 'Indu P', 'EMAIL', 'PENDING'),
      createContact('c-2', 'Indu', 'Indu P', 'LINKEDIN', 'ACCEPTED'),
    ];
    const matches = findMatchingContacts('Indu', contacts);

    expect(matches).toHaveLength(0);
  });
});
