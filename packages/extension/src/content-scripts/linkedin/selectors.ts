// =============================================================================
// RefLoop — LinkedIn DOM Selectors
// PRD §11.2: "keep every selector in one central config file so a LinkedIn
// redesign means editing one place, not hunting through the codebase."
//
// IMPORTANT: Prefer stable anchors — aria-label > visible text > structural
// position — over CSS class names (which LinkedIn obfuscates and changes).
// Each selector is documented with WHY it's stable.
// =============================================================================

/**
 * Connect / Follow button on a LinkedIn profile page.
 * Anchor: aria-label starting with "Connect" or "Invite" (stable across redesigns).
 * Fallback: visible button text matching "Connect".
 */
export const CONNECT_BUTTON_SELECTORS = [
  'button[aria-label^="Connect"]',           // primary — aria-label is stable
  'button[aria-label^="Invite"]',            // some variants say "Invite"
  'button[aria-label*="to connect"]',        // LinkedIn sometimes appends "to connect"
  '.pvs-profile-actions button:has(span:contains("Connect"))', // structural fallback
];

/**
 * "Connect" in the dropdown when clicking "More" on a profile.
 * Anchor: aria-label on the dropdown item.
 */
export const CONNECT_DROPDOWN_ITEM_SELECTOR =
  '[data-view-name="profile-actionbar-overflow-menu-item"][aria-label*="connect" i], ' +
  'li.pvs-profile-actions__action button[aria-label*="connect" i]';

/**
 * Message composer textarea (when messaging an existing connection).
 * Anchor: aria-label containing "message" (stable, screen-reader text).
 */
export const COMPOSER_TEXTAREA_SELECTORS = [
  'div.msg-form__contenteditable[contenteditable="true"]',
  'div[aria-label*="Write a message" i][contenteditable="true"]',
  'div[aria-label*="message" i][contenteditable="true"][role="textbox"]',
  '.msg-form__msg-content-container [contenteditable="true"]',
];

/**
 * Send button in the LinkedIn message composer.
 * Anchor: aria-label "Send" or button type submit within the compose form.
 */
export const COMPOSER_SEND_BUTTON_SELECTORS = [
  'button.msg-form__send-button[aria-label*="Send"]',
  'button[type="submit"][aria-label*="Send"]',
  '.msg-form__send-btn',
  'button[aria-label="Send"]',
];

/**
 * Profile name heading on a LinkedIn profile page (/in/*).
 * LinkedIn frequently alternates between h1 and h2 tags with obfuscated classes
 * across different redesigns and A/B tests.
 */
export const PROFILE_NAME_SELECTORS = [
  'main section:first-of-type h2',
  'main section:first-of-type h1',
  'section.pv-top-card h2',
  'section.pv-top-card h1',
  '.pv-top-card h2',
  '.pv-top-card h1',
  '.pv-text-details__left-panel h2',
  '.pv-text-details__left-panel h1',
  'h2.inline.t-24.v-align-middle.break-words',
  'h1.inline.t-24.v-align-middle.break-words',
  'h2.inline.t-24',
  'h1.inline.t-24',
  '.artdeco-card h2',
  '.artdeco-card h1',
  'main h2:first-of-type',
  'main h1:first-of-type',
];

const NON_PERSON_HEADINGS = new Set([
  'about',
  'experience',
  'education',
  'skills',
  'activity',
  'interests',
  'featured',
  'languages',
  'analytics',
  'resources',
  'licenses & certifications',
  'projects',
  'volunteering',
  'recommendations',
  'courses',
  'honors & awards',
  'organizations',
  'causes',
  'more profiles for you',
  'people also viewed',
  'people you may know',
  'people also follow',
  'pages people also follow',
  'people also search for',
  'similar pages',
  'affiliated company',
  'affiliated companies',
  'suggested',
  'messaging',
  'notifications',
  'feed',
  'jobs',
  'mynetwork',
]);

/**
 * Strips pronouns, badges, degrees, and extra punctuation from raw scraped names.
 */
export function cleanScrapedName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\((?:He\/Him|She\/Her|They\/Them|He\/They|She\/They|Ze\/Zir|Any pronouns)[^)]*\)/gi, '')
    .replace(/\b(?:He\/Him|She\/Her|They\/Them)\b/gi, '')
    .replace(/·\s*\d+(st|nd|rd|th)?/gi, '')
    .replace(/\b\d+(st|nd|rd|th)\b/gi, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9.\s]+$/g, '')
    .trim();
}

/**
 * Checks if a string looks like a valid person's name (not a section header).
 */
export function isValidPersonName(name: string): boolean {
  if (!name || name.length < 2) return false;
  const lower = name.toLowerCase().trim();
  if (NON_PERSON_HEADINGS.has(lower)) return false;
  if (
    lower.startsWith('more profiles') ||
    lower.startsWith('people also') ||
    lower.startsWith('people you may') ||
    lower.startsWith('pages people') ||
    lower.startsWith('similar pages') ||
    lower.startsWith('view profile') ||
    lower.startsWith('show all')
  ) {
    return false;
  }
  // Must contain at least one letter
  return /[a-zA-Z]/.test(name);
}

/**
 * Extract full name and first name from a LinkedIn profile page with multiple fallbacks.
 */
export function extractLinkedInProfileName(): { fullName: string; firstName: string } {
  // Strategy 1: Test targeted selectors
  for (const selector of PROFILE_NAME_SELECTORS) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const cleaned = cleanScrapedName(el.textContent || '');
        if (isValidPersonName(cleaned)) {
          const firstName = cleaned.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || 'Contact';
          return { fullName: cleaned, firstName };
        }
      }
    } catch {
      // skip invalid selector
    }
  }

  // Strategy 2: Search top-card container headings
  const topCard = document.querySelector('main section:first-of-type, .pv-top-card, main .artdeco-card:first-of-type');
  if (topCard) {
    const headings = topCard.querySelectorAll('h1, h2, h3');
    for (const h of headings) {
      const cleaned = cleanScrapedName(h.textContent || '');
      if (isValidPersonName(cleaned)) {
        const firstName = cleaned.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || 'Contact';
        return { fullName: cleaned, firstName };
      }
    }
  }

  // Strategy 3: Tab title fallback (e.g., "(2) Subhadeep Dan | LinkedIn" -> "Subhadeep Dan")
  if (typeof document !== 'undefined' && document.title) {
    const titleClean = document.title.replace(/^\(\d+\)\s*/, '').trim();
    const parts = titleClean.split(/\s*[\–\—\|\-]\s*/);
    if (parts.length > 0 && parts[0]) {
      const candidate = cleanScrapedName(parts[0]);
      if (isValidPersonName(candidate) && !candidate.toLowerCase().includes('linkedin')) {
        const firstName = candidate.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || 'Contact';
        return { fullName: candidate, firstName };
      }
    }
  }

  return { fullName: 'Contact', firstName: 'Contact' };
}

/**
 * Easy Apply button on a LinkedIn job posting page.
 * Anchor: button with aria-label containing "Easy Apply" (LinkedIn's own label).
 */
export const EASY_APPLY_BUTTON_SELECTORS = [
  'button[aria-label*="Easy Apply" i]',
  '.jobs-apply-button--top-card button[aria-label*="Easy Apply" i]',
  '.jobs-unified-top-card__content--two-pane button[aria-label*="Easy Apply" i]',
];

/**
 * Job title on a LinkedIn job posting page.
 * Anchor: h1 within the job top card.
 */
export const JOB_TITLE_SELECTORS = [
  'h1.job-details-jobs-unified-top-card__job-title',
  '.jobs-unified-top-card__job-title h1',
  '.jobs-unified-top-card h1',
  'h1.t-24.job-details-jobs-unified-top-card__job-title',
  '.jobs-details__main-content h1',
];

/**
 * Company name on a LinkedIn job posting page.
 * Anchor: anchor tags linking to /company/* (e.g. linkedin.com/company/jio-star/life/)
 */
export const COMPANY_NAME_SELECTORS = [
  'a[href*="/company/"]',
  '.job-details-jobs-unified-top-card__company-name a',
  '.jobs-unified-top-card__company-name a',
  '[data-tracking-control-name="public_jobs_topcard-org-name"]',
  '.jobs-unified-top-card__subtitle-top-card a:first-of-type',
];

/**
 * Company LinkedIn slug — extracted from the company profile link href.
 * e.g. linkedin.com/company/jio-star/life/ → "jio-star"
 */
export const COMPANY_LINK_SELECTOR =
  'a[href*="/company/"], ' +
  '.job-details-jobs-unified-top-card__company-name a, ' +
  '.jobs-unified-top-card__company-name a';

/**
 * "Add a note" textarea in the LinkedIn Connect confirmation dialog.
 * Used when someone has clicked Connect and LinkedIn shows an optional note field.
 * Anchor: aria-label on the textarea.
 */
export const CONNECT_NOTE_TEXTAREA_SELECTORS = [
  'textarea[name="message"]',
  'textarea[aria-label*="note" i]',
  '.send-invite__custom-message textarea',
  '.artdeco-modal textarea',
];

// ---------------------------------------------------------------------------
// Helper: try a list of selectors, return the first match
// ---------------------------------------------------------------------------

export function queryFirst(selectors: string[], root: Document | Element = document): Element | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch {
      // Selector may be invalid — skip
    }
  }
  return null;
}

export function queryAll(selectors: string[], root: Document | Element = document): Element[] {
  for (const sel of selectors) {
    try {
      const els = Array.from(root.querySelectorAll(sel));
      if (els.length > 0) return els;
    } catch {
      // skip invalid selector
    }
  }
  return [];
}
