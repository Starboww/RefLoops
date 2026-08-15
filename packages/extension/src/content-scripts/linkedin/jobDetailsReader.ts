// =============================================================================
// RefLoop — LinkedIn Job Details Reader
// Reads the job title and company name from the currently-displayed job detail
// panel (right pane) on the LinkedIn jobs search/collections page.
//
// LinkedIn's jobs search page is a split-pane SPA: clicking a job card updates
// ?currentJobId= in the URL and renders the detail panel without a full page
// navigation. The tab title never changes, so we must read the DOM directly.
//
// KEY DESIGN DECISION — class-free scraping:
// LinkedIn obfuscates ALL CSS class names (they're hash strings like "e17d282f").
// We CANNOT rely on class-based selectors. Instead we use:
//   1. href-based selectors: a[href*="/jobs/view/{id}"] for title,
//      a[href*="/company/"] for company
//   2. Semantic HTML: h1, h2 elements
//   3. URL parameters: ?currentJobId= to scope our search
//   4. Document-position ordering to pick the right element
// =============================================================================

export interface JobDetails {
  jobTitle: string;
  companyName: string;
  jobLink: string;
}

/**
 * Extract currentJobId from the URL.
 */
function getCurrentJobId(): string | null {
  try {
    return new URL(window.location.href).searchParams.get('currentJobId');
  } catch {
    return null;
  }
}

/**
 * Try to find the job title from the DOM.
 *
 * Strategy (in priority order):
 *  1. Find an <a> whose href contains /jobs/view/{currentJobId} — this is the
 *     detail-panel title link. Its textContent is the job title.
 *  2. Find any <h1> that is NOT inside the left sidebar job-list. On the
 *     search-results page the detail pane typically has the only <h1>.
 *  3. Find any <h2> in the detail pane.
 */
function findJobTitleElement(): { el: Element; text: string } | null {
  const jobId = getCurrentJobId();

  // Strategy 1 — title link with exact job ID in href
  if (jobId) {
    const titleLinks = Array.from(
      document.querySelectorAll(`a[href*="/jobs/view/${jobId}"]`)
    ) as HTMLAnchorElement[];

    // Pick the link with the most text (the title link, not a small icon link)
    let best: HTMLAnchorElement | null = null;
    let bestLen = 0;
    for (const link of titleLinks) {
      const text = link.textContent?.trim() ?? '';
      if (text.length > bestLen) {
        best = link;
        bestLen = text.length;
      }
    }
    if (best && bestLen > 2) {
      return { el: best, text: best.textContent!.trim() };
    }
  }

  // Strategy 2 — any <h1> on the page (detail pane usually has the only one)
  const h1s = Array.from(document.querySelectorAll('h1'));
  for (const h1 of h1s) {
    const text = h1.textContent?.trim() ?? '';
    // Skip empty or very short h1s (e.g. icon-only)
    if (text.length > 3) {
      return { el: h1, text };
    }
  }

  // Strategy 3 — any <a> linking to /jobs/view/ (without knowing the exact ID)
  const jobLinks = Array.from(
    document.querySelectorAll('a[href*="/jobs/view/"]')
  ) as HTMLAnchorElement[];
  let best: HTMLAnchorElement | null = null;
  let bestLen = 0;
  for (const link of jobLinks) {
    const text = link.textContent?.trim() ?? '';
    if (text.length > bestLen) {
      best = link;
      bestLen = text.length;
    }
  }
  if (best && bestLen > 3) {
    return { el: best, text: best.textContent!.trim() };
  }

  return null;
}

/**
 * Try to find the company name from the DOM, scoped near the job title element.
 *
 * The company name is always in an <a href="…/company/{slug}/…"> tag.
 * To avoid picking up company links from the left-panel job cards, we:
 *  1. Walk up from the title element to find the nearest ancestor with a company link
 *  2. Fall back to the first company link AFTER the title in document order
 */
function findCompanyName(titleEl: Element): string {
  // Strategy 1 — walk up ancestors from the title
  let ancestor: Element | null = titleEl.parentElement;
  let depth = 0;
  while (ancestor && depth < 10) {
    const companyLink = ancestor.querySelector('a[href*="/company/"]') as HTMLAnchorElement | null;
    if (companyLink) {
      const name = companyLink.textContent?.trim();
      if (name && name.length > 0) return name;

      // Fallback: convert slug from href
      return extractCompanyFromHref(companyLink.href);
    }
    ancestor = ancestor.parentElement;
    depth++;
  }

  // Strategy 2 — first company link AFTER the title in document order
  const allCompanyLinks = Array.from(
    document.querySelectorAll('a[href*="/company/"]')
  ) as HTMLAnchorElement[];
  const afterTitle = allCompanyLinks.find(
    (a) => !!(titleEl.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  if (afterTitle?.textContent?.trim()) {
    return afterTitle.textContent.trim();
  }

  // Strategy 3 — any company link on the page (last resort)
  for (const link of allCompanyLinks) {
    const name = link.textContent?.trim();
    if (name && name.length > 0) return name;
  }

  return '';
}

/**
 * Extract a human-readable company name from a /company/{slug}/ href.
 * e.g. "https://linkedin.com/company/jio-star/life/" → "Jio Star"
 */
function extractCompanyFromHref(href: string): string {
  const match = href.match(/\/company\/([^/?#]+)/);
  if (!match?.[1]) return '';
  return match[1]
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Attempts to read job details from the DOM once.
 * Returns null if the detail panel hasn't rendered yet.
 */
function tryReadJobDetails(): JobDetails | null {
  const titleResult = findJobTitleElement();
  if (!titleResult) return null;

  const { el: titleEl, text: jobTitle } = titleResult;
  const companyName = findCompanyName(titleEl);

  // Build a clean job link
  const jobId = getCurrentJobId();
  let jobLink: string;
  if (jobId) {
    jobLink = `${window.location.origin}/jobs/view/${jobId}/`;
  } else {
    jobLink = window.location.href.split('?')[0]!;
  }

  return { jobTitle, companyName, jobLink };
}

/**
 * Reads the current job details from the LinkedIn right-panel DOM.
 * Retries up to `maxRetries` times with `intervalMs` between attempts to
 * handle cases where the SPA hasn't finished rendering the panel yet.
 */
export function readCurrentJobDetails(
  maxRetries = 8,
  intervalMs = 500,
): Promise<JobDetails | null> {
  return new Promise((resolve) => {
    // Try immediately first
    const immediate = tryReadJobDetails();
    if (immediate) {
      resolve(immediate);
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const result = tryReadJobDetails();
      if (result || attempts >= maxRetries) {
        clearInterval(timer);
        resolve(result);
      }
    }, intervalMs);
  });
}
