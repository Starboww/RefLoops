// =============================================================================
// RefLoop — LinkedIn Company People Directory & Search Injector
// Injects exactly ONE small ⚡ "Add to RefLoop" button on each employee profile card
// when browsing:
//   - https://www.linkedin.com/company/{slug}/people/
//   - https://www.linkedin.com/school/{slug}/people/
//   - https://www.linkedin.com/showcase/{slug}/people/
//   - https://www.linkedin.com/search/results/people/
//
// DESIGN PRINCIPLES & INVARIANTS:
// 1. CARD-FIRST DISCOVERY:
//    We iterate over candidate profile card containers (`[role="listitem"]`, `li`),
//    NOT individual `/in/` anchor tags. Link-first traversal previously climbed up
//    the DOM and stopped at both the inner heading <div> (beside the name) and the
//    outer card <div>, creating duplicate buttons.
//
// 2. EXCLUSION OF FALSE-POSITIVE SECTIONS:
//    - Company Top Card / Banner (`pages.topCard`, `org-top-card` e.g. "Mohammad works here").
//    - "People highlights" modules (summary cards like "1 employee attended KIIT University").
//    - Navigation, header, footer, and recommendation sidebars (`scaffold-layout__aside` e.g. "dbt Labs").
//
// 3. SAFE HIGHLIGHT SCOPING (COMMON ANCESTOR TRAP):
//    LinkedIn wraps highlights, filters, and directory cards inside a shared
//    `<div data-testid="lazy-column">`. Any check that walks up to <main> and does
//    `curr.querySelector('h2, h3')` will find `<h2>People highlights</h2>` on the
//    shared parent, falsely rejecting all employee cards. We restrict highlight
//    checks strictly to `.org-people-highlights` or `h.closest('section, [data-testid="lazy-column"] > div')`.
//
// 4. WORD-BOUNDARY ACTION VALIDATION:
//    A valid candidate card must contain an action button (Connect, Invite, Follow, or Message).
//    We test with `/\b(?:connect|invite|follow|message)\b/i` and explicitly reject
//    connection count labels (e.g. `aria-label="1 connection"`), preventing summary items
//    from being mistaken for Connect buttons.
//
// 5. IDEMPOTENT POSITIONING & STAMPING:
//    Each card is stamped with `data-refloop-card-injected="slug"`. The button is styled
//    with `position: absolute; top: 10px; right: 10px;` and attached to the card container,
//    ensuring perfect placement on the top-right of the card banner.
// =============================================================================

import { openRefLoopOverlay } from './profileOverlayModal.js';
import { getLinkedInPageType } from './pageClassifier.js';
import { cleanScrapedName, isValidPersonName } from './selectors.js';

let peopleObserver: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let retryTimeouts: Array<ReturnType<typeof setTimeout>> = [];

function isPeoplePage(): boolean {
  const type = getLinkedInPageType();
  return type === 'COMPANY_PEOPLE_PAGE' || type === 'PEOPLE_SEARCH_PAGE';
}

export function initCompanyPeopleInjector() {
  if (!isPeoplePage()) {
    destroyCompanyPeopleInjector();
    return;
  }

  // Clear any existing retries before scheduling fresh ones
  clearRetryTimeouts();

  // Scan immediately
  processPeopleCards();

  // Schedule rapid burst scans for asynchronous SPA page rendering
  const burstDelays = [50, 150, 300, 600, 1000, 1500, 2200, 3500];
  burstDelays.forEach((delay) => {
    const timer = setTimeout(() => {
      if (isPeoplePage()) {
        processPeopleCards();
      }
    }, delay);
    retryTimeouts.push(timer);
  });

  // Watch for new cards dynamically rendered on scroll / filter
  if (!peopleObserver) {
    peopleObserver = new MutationObserver(() => {
      if (!chrome.runtime?.id) {
        destroyCompanyPeopleInjector();
        return;
      }
      if (isPeoplePage()) {
        processPeopleCards();
      }
    });

    peopleObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Fallback periodic scan for dynamically updated DOM chunks
  if (!scanInterval) {
    scanInterval = setInterval(() => {
      if (!chrome.runtime?.id) {
        destroyCompanyPeopleInjector();
        return;
      }
      if (isPeoplePage()) {
        processPeopleCards();
      }
    }, 500);
  }
}

function clearRetryTimeouts() {
  retryTimeouts.forEach((timer) => clearTimeout(timer));
  retryTimeouts = [];
}

export function destroyCompanyPeopleInjector() {
  clearRetryTimeouts();

  if (peopleObserver) {
    peopleObserver.disconnect();
    peopleObserver = null;
  }

  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }

  document.querySelectorAll('.refloop-company-people-btn').forEach((btn) => btn.remove());
  document.querySelectorAll('[data-refloop-card-injected]').forEach((el) => el.removeAttribute('data-refloop-card-injected'));
}

function extractCompanySlugAndName(): { slug: string; name: string } {
  const match = window.location.pathname.match(/\/(?:company|school)\/([^/]+)/i);
  const slug = match ? match[1] ?? '' : '';

  // Try extracting cleaner title from page h1/header if available
  const headerEl = document.querySelector(
    '.org-top-card-summary__title, h1.org-top-card-summary__title, .org-top-card-primary-content__title, .org-top-card__title, h1',
  );
  const nameFromHeader = headerEl?.textContent?.trim();

  const name = nameFromHeader || (slug ? slug.replace(/-/g, ' ') : '');
  return { slug, name };
}

function getProfileSlug(href: string): string | null {
  const match = href.match(/\/in\/([^/?#]+)/i);
  return match ? match[1]!.toLowerCase() : null;
}

function isInsideHighlights(card: HTMLElement): boolean {
  // 1. Direct class or testid check on ancestors
  if (
    card.closest(
      '.org-people-highlights, [data-test-id*="highlight"], [data-testid*="highlight"], [componentkey*="highlight" i], .org-people-directory__highlights'
    )
  ) {
    return true;
  }

  // 2. Highlights container check: Find any heading on page containing "highlight"
  // and see if its container section/card contains this card.
  // Note: We check specifically its enclosing section or immediate lazy-column child, NOT the entire lazy-column!
  const highlightHeadings = Array.from(document.querySelectorAll('h1, h2, h3')).filter((h) =>
    (h.textContent || '').toLowerCase().includes('highlight')
  );
  for (const h of highlightHeadings) {
    const section =
      h.closest('section, [data-testid="lazy-column"] > div, .artdeco-card') ||
      h.parentElement?.parentElement;
    if (section && section.contains(card)) {
      return true;
    }
  }

  return false;
}

function extractNameFromCard(card: HTMLElement): string {
  // 1. Action button / link aria-label (e.g. "Invite Vishwas Modi to connect", "Follow Kiran Pm", "Send a message to Pranav Ojha")
  const actionEl = card.querySelector<HTMLElement>(
    'button[aria-label*="Invite"], button[aria-label*="Connect"], button[aria-label*="Message"], button[aria-label*="Follow"], a[aria-label*="message" i]',
  );
  if (actionEl) {
    const aria = actionEl.getAttribute('aria-label') || '';
    const m =
      aria.match(/^Invite\s+(.+?)\s+to\s+connect/i) ||
      aria.match(/^Connect\s+with\s+(.+)/i) ||
      aria.match(/^Follow\s+(.+)/i) ||
      aria.match(/^Message\s+(.+)/i) ||
      aria.match(/^Send\s+a\s+message\s+to\s+(.+)/i);
    if (m && m[1]) {
      const candidate = cleanScrapedName(m[1].trim());
      if (isValidPersonName(candidate)) return candidate;
    }
  }

  // 2. Profile picture aria-label (e.g. "Vishwas Modi’s profile picture")
  const pic = card.querySelector<HTMLElement>('[aria-label*="profile picture" i]');
  if (pic) {
    const aria = pic.getAttribute('aria-label') || '';
    const m = aria.match(/^(.+?)[’\x27]s\s+profile\s+picture/i);
    if (m && m[1]) {
      const candidate = cleanScrapedName(m[1].trim());
      if (isValidPersonName(candidate)) return candidate;
    }
  }

  // 3. Headings or titles inside card
  const titleEl = card.querySelector<HTMLElement>(
    '.org-people-profile-card__profile-title, .artdeco-entity-lockup__title, .entity-result__title-text, .discover-person-card__name, [data-view-name*="title"], h3, h4, h2, strong',
  );
  if (titleEl?.textContent?.trim()) {
    const candidate = cleanScrapedName(titleEl.textContent.trim());
    if (isValidPersonName(candidate)) return candidate;
  }

  // 4. Text content of profile link
  const inLinks = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]'));
  for (const a of inLinks) {
    const txt = cleanScrapedName(a.textContent || '');
    if (txt && txt.length > 2 && isValidPersonName(txt)) {
      return txt;
    }
  }

  return 'Contact';
}

export function processPeopleCards() {
  if (!isPeoplePage()) return;

  const { name: companyNameHint } = extractCompanySlugAndName();

  const candidateCards = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="listitem"], li.org-people-profiles-module__profile-item, li.reusable-search__result-container, .org-people-profile-card, li.org-people-profile-card__profile-card-spacing, li',
    ),
  );

  let newlyInjected = 0;

  candidateCards.forEach((card) => {
    // 1. Never inject on elements that have display: contents (they generate no visual box)
    if (card.getAttribute('data-display-contents') === 'true') return;
    if (card.hasAttribute('data-refloop-card-injected')) return;
    if (card.querySelector('.refloop-company-people-btn')) return;

    // 2. Reject if inside company top card, header, nav, aside, or footer
    if (
      card.closest(
        'header, nav, #global-nav, .global-nav, footer, aside, .scaffold-layout__aside, [id*="topCard" i], [componentkey*="topCard" i], .org-top-card, .org-people-highlights',
      )
    ) {
      return;
    }

    // 3. Reject if inside highlights section
    if (isInsideHighlights(card)) return;

    // 4. Must have an action element (Connect / Invite / Follow button or Message button/link)
    // Note: Use word boundary regex and exclude connection counts
    const buttons = Array.from(
      card.querySelectorAll<HTMLElement>(
        'button, a[href*="messaging/compose"], a[aria-label*="message" i]',
      ),
    );
    const actionEl = buttons.find((el) => {
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const text = (el.textContent || '').trim().toLowerCase();
      const href = (el.getAttribute('href') || '').toLowerCase();

      // Reject connection count links like "1 connection", "12 connections", "mutual connection"
      if (aria.includes('connection') || text.includes('connection')) {
        return false;
      }

      const actionRegex = /\b(?:connect|invite|follow|message)\b/i;
      return (
        actionRegex.test(aria) ||
        actionRegex.test(text) ||
        href.includes('messaging/compose')
      );
    });
    if (!actionEl) return;

    // 5. Must have at least one valid /in/ profile link
    const inLinks = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')).filter((a) => {
      const rawHref = a.getAttribute('href') || '';
      const textContent = (a.textContent || '').toLowerCase();
      const ariaLabel = (a.getAttribute('aria-label') || '').toLowerCase();
      return (
        rawHref.includes('/in/') &&
        !rawHref.includes('/in/unavailable/') &&
        !textContent.includes('works here') &&
        !ariaLabel.includes('works here')
      );
    });
    if (inLinks.length === 0) return;

    // 6. Must resolve to exactly ONE unique profile slug (not a multi-person container)
    const slugs = new Set<string>();
    inLinks.forEach((a) => {
      const s = getProfileSlug(a.getAttribute('href') || '');
      if (s) slugs.add(s);
    });
    if (slugs.size !== 1) return;

    const slug = Array.from(slugs)[0]!;
    if (document.querySelector(`button.refloop-company-people-btn[data-refloop-slug="${slug}"]`)) {
      return;
    }

    // 7. Inject button on this card
    const primaryAnchor = inLinks[0]!;
    const rawHref = primaryAnchor.getAttribute('href') || '';
    let cleanProfileUrl = rawHref.split('?')[0]!.split('#')[0]!;
    if (!cleanProfileUrl.startsWith('http')) {
      cleanProfileUrl = `https://www.linkedin.com${cleanProfileUrl}`;
    }

    const fullName = extractNameFromCard(card);

    // Ensure card is relative positioning context for the button
    const computedPosition = window.getComputedStyle(card).position;
    if (computedPosition === 'static') {
      card.style.position = 'relative';
    }

    card.setAttribute('data-refloop-card-injected', slug);

    const btn = document.createElement('button');
    btn.className = 'refloop-company-people-btn';
    btn.title = `Add ${fullName} to RefLoop`;
    btn.setAttribute('aria-label', `Add ${fullName} to RefLoop`);
    btn.setAttribute('data-refloop-slug', slug);
    btn.innerHTML = `⚡`;

    btn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #FF3C6B 0%, #FF2458 100%);
      color: #ffffff;
      border: 1.5px solid rgba(255, 255, 255, 0.4);
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(255, 60, 107, 0.4);
      z-index: 100;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0.95;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.15)';
      btn.style.opacity = '1';
      btn.style.boxShadow = '0 4px 14px rgba(255, 60, 107, 0.6)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.opacity = '0.95';
      btn.style.boxShadow = '0 2px 8px rgba(255, 60, 107, 0.4)';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      openRefLoopOverlay({
        fullName,
        profileUrl: cleanProfileUrl,
        companyNameHint,
      });
    });

    card.appendChild(btn);
    newlyInjected++;
  });

  if (newlyInjected > 0) {
    console.log(`[RefLoop] Injected ⚡ buttons on ${newlyInjected} profile cards`);
  }
}
