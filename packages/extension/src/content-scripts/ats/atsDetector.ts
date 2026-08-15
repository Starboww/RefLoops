// =============================================================================
// RefLoop — ATS URL Detector
// PRD §8.1: auto-detect recognized ATS job-posting pages.
// Returns parsed job metadata from URL patterns.
// =============================================================================

export interface ATSDetectionResult {
  ats: string;
  companySlug: string;
  companyJobId: string;
  /** Best-effort company name from URL slug */
  companyNameFromUrl: string;
}

interface ATSPattern {
  name: string;
  /** Regex with named capture groups: companySlug, jobId */
  pattern: RegExp;
  extractJobId: (match: RegExpMatchArray) => string;
  extractCompany: (match: RegExpMatchArray) => string;
}

// ---------------------------------------------------------------------------
// ATS URL patterns — PRD §8.1
// ---------------------------------------------------------------------------

const ATS_PATTERNS: ATSPattern[] = [
  // Greenhouse: boards.greenhouse.io/{company}/jobs/{digits}
  {
    name: 'Greenhouse',
    pattern: /boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i,
    extractJobId: (m) => m[2] ?? '',
    extractCompany: (m) => m[1] ?? '',
  },

  // Lever: jobs.lever.co/{company}/{uuid}
  {
    name: 'Lever',
    pattern: /jobs\.lever\.co\/([^/]+)\/([0-9a-f-]{36})/i,
    extractJobId: (m) => m[2] ?? '',
    extractCompany: (m) => m[1] ?? '',
  },

  // Workday: {company}.wd{n}.myworkdayjobs.com/…/job/…/{REQ-code}
  {
    name: 'Workday',
    pattern: /([^.]+)\.wd\d+\.myworkdayjobs\.com.*\/job\/[^/]+\/([^/?#]+)/i,
    extractJobId: (m) => m[2] ?? '',
    extractCompany: (m) => m[1] ?? '',
  },

  // SmartRecruiters: jobs.smartrecruiters.com/{company}/{digits}-{slug}
  {
    name: 'SmartRecruiters',
    pattern: /jobs\.smartrecruiters\.com\/([^/]+)\/(\d+)-/i,
    extractJobId: (m) => m[2] ?? '',
    extractCompany: (m) => m[1] ?? '',
  },

  // iCIMS: {company}.icims.com/jobs/{digits}/{slug}/job
  {
    name: 'iCIMS',
    pattern: /([^.]+)\.icims\.com\/jobs\/(\d+)\//i,
    extractJobId: (m) => m[2] ?? '',
    extractCompany: (m) => m[1] ?? '',
  },

  // Ashby: jobs.ashbyhq.com/{company}/{uuid}
  {
    name: 'Ashby',
    pattern: /jobs\.ashbyhq\.com\/([^/]+)\/([0-9a-f-]{36})/i,
    extractJobId: (m) => m[2] ?? '',
    extractCompany: (m) => m[1] ?? '',
  },

  // Taleo: *.taleo.net/careersection/…/jobdetail.ftl?job={code}
  {
    name: 'Taleo',
    pattern: /taleo\.net\/careersection\/.+?\/jobdetail\.ftl.*[?&]job=([^&]+)/i,
    extractJobId: (m) => m[1] ?? '',
    extractCompany: (m) => {
      // Extract company from subdomain: company.taleo.net
      const subdomain = m.input?.match(/^https?:\/\/([^.]+)\.taleo\.net/i);
      return subdomain?.[1] ?? 'unknown';
    },
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to detect a recognized ATS job posting from the given URL.
 * Returns null if not recognized.
 */
export function detectATS(url: string): ATSDetectionResult | null {
  for (const ats of ATS_PATTERNS) {
    const match = url.match(ats.pattern);
    if (match) {
      const companySlug = ats.extractCompany(match);
      const companyJobId = ats.extractJobId(match);
      return {
        ats: ats.name,
        companySlug,
        companyJobId,
        companyNameFromUrl: slugToName(companySlug),
      };
    }
  }
  return null;
}

/** Convert a URL slug to a human-readable company name */
function slugToName(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
