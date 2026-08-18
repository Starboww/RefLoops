import { describe, it, expect } from 'vitest';
import {
  normalizeLinkedInProfileUrl,
  normalizeEmail,
  isDuplicateContact,
} from '../domain/urlUtils.js';
import type { Contact } from '../domain/models.js';

describe('normalizeLinkedInProfileUrl', () => {
  it('normalizes various LinkedIn URL formats to a canonical path', () => {
    const urls = [
      'https://www.linkedin.com/in/satyanadella',
      'https://www.linkedin.com/in/satyanadella/',
      'http://linkedin.com/in/satyanadella?miniProfileUrn=urn%3Ali%3Afs_miniProfile',
      'https://in.linkedin.com/in/SatyaNadella/',
      'https://www.linkedin.com/in/satyanadella#experience',
      'www.linkedin.com/in/satyanadella',
      'linkedin.com/in/satyanadella/',
      '/in/satyanadella',
      '/in/satyanadella/',
    ];

    for (const u of urls) {
      expect(normalizeLinkedInProfileUrl(u)).toBe('/in/satyanadella');
    }
  });

  it('handles empty or invalid inputs gracefully', () => {
    expect(normalizeLinkedInProfileUrl('')).toBe('');
    expect(normalizeLinkedInProfileUrl(undefined)).toBe('');
    expect(normalizeLinkedInProfileUrl(null)).toBe('');
    expect(normalizeLinkedInProfileUrl('   ')).toBe('');
  });
});

describe('normalizeEmail', () => {
  it('normalizes emails to lowercase and trimmed', () => {
    expect(normalizeEmail('  John.Doe@Example.com ')).toBe('john.doe@example.com');
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('isDuplicateContact', () => {
  const baseContact: Contact = {
    id: 'c-1',
    jobPostingId: 'job-1',
    channel: 'LINKEDIN',
    firstName: 'Satya',
    linkedinProfileUrl: 'https://www.linkedin.com/in/satyanadella',
    outreachMessageStatus: 'QUEUED',
    followUp1Status: 'NOT_SCHEDULED',
    followUp2Status: 'NOT_SCHEDULED',
  };

  const emailContact: Contact = {
    id: 'c-2',
    jobPostingId: 'job-1',
    channel: 'EMAIL',
    firstName: 'Bill',
    emailAddress: 'bill.gates@gatesfoundation.org',
    outreachMessageStatus: 'READY_TO_SEND',
    followUp1Status: 'NOT_SCHEDULED',
    followUp2Status: 'NOT_SCHEDULED',
  };

  const contacts = [baseContact, emailContact];

  it('detects duplicate LinkedIn profile on the same job with different URL formats', () => {
    expect(
      isDuplicateContact(contacts, {
        jobPostingId: 'job-1',
        channel: 'LINKEDIN',
        linkedinProfileUrl: 'https://linkedin.com/in/satyanadella/?trk=feed',
      }),
    ).toBe(true);

    expect(
      isDuplicateContact(contacts, {
        jobPostingId: 'job-1',
        channel: 'LINKEDIN',
        linkedinProfileUrl: 'http://in.linkedin.com/in/SatyaNadella',
      }),
    ).toBe(true);
  });

  it('does not flag duplicate if LinkedIn profile is different', () => {
    expect(
      isDuplicateContact(contacts, {
        jobPostingId: 'job-1',
        channel: 'LINKEDIN',
        linkedinProfileUrl: 'https://www.linkedin.com/in/sundarpichai',
      }),
    ).toBe(false);
  });

  it('does not flag duplicate if same profile is added to a DIFFERENT job', () => {
    expect(
      isDuplicateContact(contacts, {
        jobPostingId: 'job-2',
        channel: 'LINKEDIN',
        linkedinProfileUrl: 'https://www.linkedin.com/in/satyanadella',
      }),
    ).toBe(false);
  });

  it('detects duplicate Email contact on the same job', () => {
    expect(
      isDuplicateContact(contacts, {
        jobPostingId: 'job-1',
        channel: 'EMAIL',
        emailAddress: 'BILL.GATES@GATESFOUNDATION.ORG',
      }),
    ).toBe(true);
  });

  it('does not flag removed contacts as duplicates', () => {
    const removedContact: Contact = {
      ...baseContact,
      id: 'c-3',
      linkedinProfileUrl: 'https://www.linkedin.com/in/samaltman',
      removedAt: new Date().toISOString(),
    };

    expect(
      isDuplicateContact([removedContact], {
        jobPostingId: 'job-1',
        channel: 'LINKEDIN',
        linkedinProfileUrl: 'https://www.linkedin.com/in/samaltman',
      }),
    ).toBe(false);
  });
});
