// =============================================================================
// RefLoop — EmailPatternService
// PRD §9: Email channel & permutation/generator tool
// Generates ranked candidate email addresses from a person's name + company domain.
// =============================================================================

export interface NameParts {
  first: string;
  last: string;
  middle?: string | undefined;
}

export type EmailTier = 1 | 2 | 3 | 'middle';

export interface RankedCandidate {
  email: string;
  tier: EmailTier;
  /** Human-readable pattern name e.g. "first.last" */
  pattern: string;
}

// Suffixes to strip — PRD §9.2
const SUFFIXES = /\b(jr|sr|ii|iii|iv|v|esq|phd|md|dds|dvm)\.?$/i;

// Common diacritics map for normalization — PRD §9.2
const DIACRITIC_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', æ: 'ae',
  ç: 'c', è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ñ: 'n', ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y', ß: 'ss', þ: 'th', ð: 'd',
};

export class EmailPatternService {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Generate ranked, de-duplicated candidate email addresses.
   * PRD §9.3: full tier logic with optional confirmed-pattern inference.
   *
   * @param nameParts Parsed name components
   * @param domain Company email domain (e.g. "microsoft.com")
   * @param confirmedEmail Optional known real email to infer company pattern (§9.5 gold-standard)
   */
  generateCandidates(
    nameParts: NameParts,
    domain: string,
    confirmedEmail?: string,
  ): RankedCandidate[] {
    const norm = this.normalizeNameParts(nameParts);
    const domainClean = domain.toLowerCase().trim();

    // Gold-standard: if we have a confirmed email, apply its pattern first
    if (confirmedEmail) {
      const inferred = this.applyInferredPattern(confirmedEmail, domainClean, norm);
      if (inferred) {
        // Return inferred result as tier 1, followed by normal tier candidates
        const normal = this.buildTierCandidates(norm, domainClean);
        const seen = new Set<string>([inferred.email]);
        const rest = normal.filter((c) => !seen.has(c.email));
        return [inferred, ...rest];
      }
    }

    return this.buildTierCandidates(norm, domainClean);
  }

  /**
   * Infer a company's email pattern from one confirmed real address.
   * PRD §9.5: "one confirmed example beats population-wide statistics every time"
   */
  inferPatternFromConfirmed(
    confirmedEmail: string,
    _domain: string,
    exampleName: NameParts,
  ): string | null {
    const local = confirmedEmail.split('@')[0];
    if (!local) return null;

    const norm = this.normalizeNameParts(exampleName);
    const { f, l, first, last } = norm;

    // Match against known patterns
    const patterns: Array<[string, string]> = [
      [`${first}.${last}`, 'first.last'],
      [`${f}${last}`, 'flast'],
      [`${first}${l}`, 'firstl'],
      [`${first}${last}`, 'firstlast'],
      [`${first}`, 'first'],
      [`${f}.${last}`, 'f.last'],
      [`${last}.${first}`, 'last.first'],
      [`${last}${first}`, 'lastfirst'],
      [`${f}${l}`, 'fl'],
      [`${last}`, 'last'],
      [`${first}_${last}`, 'first_last'],
      [`${first}-${last}`, 'first-last'],
    ];

    for (const [localPattern, patternName] of patterns) {
      if (local === localPattern) return patternName;
    }

    return null;
  }

  /**
   * Apply an inferred pattern to generate a specific candidate address.
   */
  applyInferredPattern(
    confirmedEmail: string,
    domain: string,
    norm: NormalizedName,
  ): RankedCandidate | null {
    const local = confirmedEmail.split('@')[0];
    if (!local) return null;

    // Try to reverse-engineer the pattern from the confirmed email
    const { f, l, first, last } = norm;

    const confirmedDomain = confirmedEmail.split('@')[1] ?? '';
    if (confirmedDomain !== domain) return null;

    const candidates = [
      `${first}.${last}`,
      `${f}${last}`,
      `${first}${l}`,
      `${first}${last}`,
      `${first}`,
      `${f}.${last}`,
      `${last}.${first}`,
    ];

    for (const candidate of candidates) {
      if (this.matchesPattern(local, candidate)) {
        return {
          email: `${candidate}@${domain}`,
          tier: 1,
          pattern: 'inferred-from-confirmed',
        };
      }
    }

    return null;
  }

  /**
   * Normalize a full display name into NameParts.
   */
  parseDisplayName(displayName: string): NameParts {
    let clean = displayName.replace(/\p{Emoji}/gu, '').trim();
    clean = clean.replace(/\(.*?\)/g, '').trim();
    clean = clean.replace(/,.*$/, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? '';
    const last = parts[parts.length - 1] ?? '';
    const middle = parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined;
    
    const result: NameParts = { first, last };
    if (middle !== undefined) result.middle = middle;
    return result;
  }

  /**
   * Extract firstName from a LinkedIn display name (PRD §8.1):
   */
  parseFirstName(displayName: string): string {
    const parts = this.parseDisplayName(displayName);
    return this.normalizePart(parts.first);
  }

  // ---------------------------------------------------------------------------
  // Private — normalization
  // ---------------------------------------------------------------------------

  private normalizeNameParts(nameParts: NameParts): NormalizedName {
    const first = this.normalizePart(nameParts.first);
    const last = this.normalizePart(nameParts.last);
    const middle = nameParts.middle ? this.normalizePart(nameParts.middle) : undefined;

    const result: NormalizedName = {
      first,
      last,
      f: first[0] ?? '',
      l: last[0] ?? '',
      m: middle?.[0] ?? '',
    };
    if (middle !== undefined) result.middle = middle;
    return result;
  }

  private normalizePart(part: string): string {
    let result = part.toLowerCase();
    result = result
      .split('')
      .map((ch) => DIACRITIC_MAP[ch] ?? ch)
      .join('');
    result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    result = result.replace(/'/g, '');
    result = result.replace(SUFFIXES, '').trim();
    result = result.replace(/[^a-z-]/g, '');
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private — tier generation (PRD §9.3)
  // ---------------------------------------------------------------------------

  private buildTierCandidates(norm: NormalizedName, domain: string): RankedCandidate[] {
    const { f, l, first, last, middle, m } = norm;
    const seen = new Set<string>();
    const results: RankedCandidate[] = [];

    const add = (local: string, tier: EmailTier, pattern: string) => {
      if (!local) return;
      const email = `${local}@${domain}`;
      if (!seen.has(email)) {
        seen.add(email);
        results.push({ email, tier, pattern });
      }
    };

    // Tier 1 — PRD §9.3
    add(`${first}.${last}`, 1, 'first.last');
    add(`${f}${last}`, 1, 'flast');
    add(`${first}${l}`, 1, 'firstl');

    // Tier 2
    add(`${first}${last}`, 2, 'firstlast');
    add(first, 2, 'first');
    add(`${f}.${last}`, 2, 'f.last');
    add(`${first}.${l}`, 2, 'first.l');

    // Tier 3
    add(`${last}.${first}`, 3, 'last.first');
    add(`${l}.${first}`, 3, 'l.first');
    add(`${last}.${f}`, 3, 'last.f');
    add(`${last}${first}`, 3, 'lastfirst');
    add(`${l}${first}`, 3, 'lfirst');
    add(`${last}${f}`, 3, 'lastf');
    add(`${f}${l}`, 3, 'fl');
    add(last, 3, 'last');
    add(`${first}_${last}`, 3, 'first_last');
    add(`${first}-${last}`, 3, 'first-last');

    // Hyphenated last name variants — PRD §9.2
    if (last.includes('-')) {
      const lastFirst = last.split('-')[0] ?? last;
      const lastJoined = last.replace(/-/g, '');
      add(`${first}.${lastFirst}`, 3, 'first.last-firstcomponent');
      add(`${first}.${lastJoined}`, 3, 'first.lastjoined');
      add(`${f}${lastFirst}`, 3, 'f+lastfirstcomponent');
    }

    // Middle name variants — PRD §9.3
    if (middle && m) {
      add(`${first}.${m}.${last}`, 'middle', 'first.m.last');
      add(`${first}${m}${last}`, 'middle', 'firstmlast');
      add(`${f}${m}${last}`, 'middle', 'fmlast');
    }

    return results;
  }

  private matchesPattern(local: string, candidate: string): boolean {
    return local === candidate;
  }
}

interface NormalizedName {
  first: string;
  last: string;
  middle?: string | undefined;
  f: string;
  l: string;
  m: string;
}
