import { describe, it, expect } from 'vitest';
import { EmailPatternService } from '../services/EmailPatternService.js';

const svc = new EmailPatternService();

describe('EmailPatternService.generateCandidates', () => {
  it('generates correct tier-1 candidates for John Doe @ microsoft.com', () => {
    const results = svc.generateCandidates({ first: 'John', last: 'Doe' }, 'microsoft.com');
    const emails = results.map((r) => r.email);
    // Tier 1 includes first.last, first, flast, firstl
    expect(emails).toContain('john.doe@microsoft.com');
    expect(emails).toContain('john@microsoft.com');
    expect(emails).toContain('jdoe@microsoft.com');
    expect(emails).toContain('johnd@microsoft.com');
  });

  it('generates suraj@mojro.com in Tier 1 for Suraj Soni @ mojro.com', () => {
    const results = svc.generateCandidates({ first: 'Suraj', last: 'Soni' }, 'mojro.com');
    const tier1 = results.filter((r) => r.tier === 1).map((r) => r.email);
    expect(tier1).toContain('suraj@mojro.com');
    expect(tier1).toContain('suraj.soni@mojro.com');
  });

  it('tier-1 candidates appear before tier-2 and tier-3', () => {
    const results = svc.generateCandidates({ first: 'John', last: 'Doe' }, 'example.com');
    const tiers = results.map((r) => r.tier);
    const firstNon1 = tiers.findIndex((t) => t !== 1);
    const lastTier1 = tiers.lastIndexOf(1);
    if (firstNon1 !== -1 && lastTier1 !== -1) {
      expect(lastTier1).toBeLessThan(firstNon1);
    }
  });

  it('generates middle-name variants for John F Kennedy', () => {
    const results = svc.generateCandidates(
      { first: 'John', last: 'Kennedy', middle: 'F' },
      'example.com',
    );
    const emails = results.map((r) => r.email);
    expect(emails).toContain('john.f.kennedy@example.com');
    expect(emails).toContain('johnfkennedy@example.com');
    expect(emails).toContain('jfkennedy@example.com');
  });

  it('de-duplicates candidates', () => {
    const results = svc.generateCandidates({ first: 'Lee', last: 'Lee' }, 'example.com');
    const emails = results.map((r) => r.email);
    const unique = new Set(emails);
    expect(emails.length).toBe(unique.size);
  });

  it('normalizes diacritics: José → jose', () => {
    const results = svc.generateCandidates({ first: 'José', last: 'García' }, 'example.com');
    const emails = results.map((r) => r.email);
    expect(emails).toContain('jose.garcia@example.com');
  });

  it("normalizes O'Brien → obrien", () => {
    const results = svc.generateCandidates({ first: 'Patrick', last: "O'Brien" }, 'example.com');
    const emails = results.map((r) => r.email);
    expect(emails.some((e) => e.includes('obrien'))).toBe(true);
  });

  it('handles hyphenated last names', () => {
    const results = svc.generateCandidates(
      { first: 'Anna', last: 'Smith-Jones' },
      'example.com',
    );
    const emails = results.map((r) => r.email);
    // Should have both smithjones joined and smith (first component)
    expect(emails.some((e) => e.includes('smithjones'))).toBe(true);
    expect(emails.some((e) => e.includes('smith'))).toBe(true);
  });

  it('drops suffixes: John Doe Jr. → john doe', () => {
    const results = svc.generateCandidates({ first: 'John', last: 'Doe Jr.' }, 'example.com');
    const emails = results.map((r) => r.email);
    // "jr" or "jr." should not appear in email locals
    expect(emails.every((e) => !e.split('@')[0]?.endsWith('jr'))).toBe(true);
  });
});

describe('EmailPatternService.parseFirstName', () => {
  it('extracts first name from simple name', () => {
    expect(svc.parseFirstName('John Doe')).toBe('john');
  });

  it('strips credentials (MBA, PhD)', () => {
    expect(svc.parseFirstName('Jane Smith, MBA')).toBe('jane');
  });

  it('strips pronouns in parens', () => {
    expect(svc.parseFirstName('Jane Smith (she/her)')).toBe('jane');
  });

  it('strips emoji', () => {
    expect(svc.parseFirstName('Jane Smith ⭐')).toBe('jane');
  });

  it('handles mixed credential + pronoun', () => {
    expect(svc.parseFirstName('Jane Smith, MBA ⭐ (she/her)')).toBe('jane');
  });
});
