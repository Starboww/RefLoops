// =============================================================================
// RefLoop — FuzzySearchService
// PRD §7.2: company picker — 3 most-recent + fuzzy search
// =============================================================================

import type { JobPosting } from '../domain/models.js';

export class FuzzySearchService {
  /**
   * Fuzzy-search ACTIVE jobs by company name.
   * Case-insensitive substring match + basic Levenshtein-based scoring.
   * Returns sorted by match quality (best first).
   */
  searchCompanies(query: string, jobs: JobPosting[]): JobPosting[] {
    if (!query.trim()) return [];

    const q = query.toLowerCase().trim();
    const activeJobs = jobs.filter((j) => j.status === 'ACTIVE');

    const scored = activeJobs
      .map((job) => ({
        job,
        score: this.matchScore(q, job.companyName.toLowerCase()),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.job);
  }

  /**
   * Return the `count` most recently added ACTIVE jobs, one per unique companyName.
   * Used for the quick-pick top-3 companies in the LinkedIn Connect popup.
   * PRD §7.2: "3 most-recently-added companies (by dateAdded on their job postings)"
   */
  getRecentCompanies(jobs: JobPosting[], count = 3): JobPosting[] {
    const activeJobs = jobs
      .filter((j) => j.status === 'ACTIVE')
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());

    // Deduplicate by companyName — keep the most recent entry per company
    const seen = new Set<string>();
    const result: JobPosting[] = [];
    for (const job of activeJobs) {
      const key = job.companyName.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(job);
        if (result.length >= count) break;
      }
    }
    return result;
  }

  /**
   * When a company has multiple ACTIVE jobs, return them all (for the secondary job picker).
   * PRD §7.2 step 3.
   */
  getJobsForCompany(companyName: string, jobs: JobPosting[]): JobPosting[] {
    const key = companyName.toLowerCase().trim();
    return jobs.filter(
      (j) => j.status === 'ACTIVE' && j.companyName.toLowerCase().trim() === key,
    );
  }

  // ---------------------------------------------------------------------------
  // Private — scoring
  // ---------------------------------------------------------------------------

  private matchScore(query: string, target: string): number {
    // Exact match
    if (target === query) return 1000;
    // Starts with query
    if (target.startsWith(query)) return 500;
    // Contains query as substring
    if (target.includes(query)) return 200;
    // Word starts with query (e.g. "go" matches "Google")
    const words = target.split(/[\s\-_]+/);
    if (words.some((w) => w.startsWith(query))) return 100;
    // Fuzzy: each query char appears in target in order
    if (this.isFuzzyMatch(query, target)) return 50;
    return 0;
  }

  private isFuzzyMatch(query: string, target: string): boolean {
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti++) {
      if (target[ti] === query[qi]) qi++;
    }
    return qi === query.length;
  }
}
