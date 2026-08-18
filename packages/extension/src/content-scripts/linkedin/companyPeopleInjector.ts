// =============================================================================
// RefLoop — LinkedIn Company People Directory Injector
// Injects small ⚡ "Add to RefLoop" buttons on each profile card
// when viewing https://www.linkedin.com/company/{slug}/people/
// =============================================================================

import { openRefLoopOverlay } from './profileOverlayModal.js';
import { getLinkedInPageType } from './pageClassifier.js';
import { cleanScrapedName, isValidPersonName } from './selectors.js';

let peopleObserver: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let retryTimeouts: Array<ReturnType<typeof setTimeout>> = [];

export function initCompanyPeopleInjector() {
  if (getLinkedInPageType() !== 'COMPANY_PEOPLE_PAGE') {
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
      if (getLinkedInPageType() === 'COMPANY_PEOPLE_PAGE') {
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
      if (getLinkedInPageType() === 'COMPANY_PEOPLE_PAGE') {
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
      if (getLinkedInPageType() === 'COMPANY_PEOPLE_PAGE') {
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
}

function extractCompanySlugAndName(): { slug: string; name: string } {
  const match = window.location.pathname.match(/\/(?:company|school)\/([^/]+)/i);
  const slug = match ? match[1] ?? '' : '';

  // Try extracting cleaner title from page h1/header if available
  const headerEl = document.querySelector(
    '.org-top-card-summary__title, h1.org-top-card-summary__title, .org-top-card-primary-content__title, .org-top-card__title, h1',
  );
  const nameFromHeader = headerEl?.textContent?.trim();

  const name = nameFromHeader || slug.replace(/-/g, ' ');
  return { slug, name };
}

function isInvalidCardAncestor(el: HTMLElement): boolean {
  if (el === document.body || el.tagName === 'MAIN' || el.tagName === 'BODY' || el.tagName === 'HTML') return true;
  if (el.classList.contains('scaffold-layout__main') || el.classList.contains('scaffold-layout__content')) return true;
  if (el.classList.contains('org-people-profiles-module__profile-list')) return true;
  if (el.classList.contains('org-people-directory')) return true;
  return false;
}

function isSingleCard(el: HTMLElement): boolean {
  if (isInvalidCardAncestor(el)) return false;

  // An individual card should not contain multiple Connect/Invite/Message buttons
  const buttons = el.querySelectorAll('button');
  let actionBtnCount = 0;
  buttons.forEach((b) => {
    const t = (b.textContent || '').trim().toLowerCase();
    const a = (b.getAttribute('aria-label') || '').toLowerCase();
    if (
      t === 'connect' ||
      t === 'invite' ||
      t === 'message' ||
      t === 'follow' ||
      a.includes('connect') ||
      a.includes('invite')
    ) {
      actionBtnCount++;
    }
  });

  if (actionBtnCount > 1) return false;

  // It should contain at least one /in/ link
  const inLinks = el.querySelectorAll('a[href*="/in/"]');
  if (inLinks.length === 0) return false;

  // If it's a section with a general title like "People you may know", it's the whole section container, not a single card
  const sectionTitle = el.querySelector('h2, h3');
  if (sectionTitle) {
    const titleText = (sectionTitle.textContent || '').trim().toLowerCase();
    if (titleText.includes('people you may know') || titleText.includes('people also follow')) {
      return false;
    }
  }

  return true;
}

function findSingleCard(anchorOrBtn: HTMLElement): HTMLElement | null {
  // 1. Try known specific card item selectors
  const specific = anchorOrBtn.closest<HTMLElement>(
    'li.org-people-profiles-module__profile-item, ' +
    'li.org-people-profile-card__profile-card-spacing, ' +
    '.org-people-profile-card, ' +
    '[data-view-name*="profile-card"], ' +
    '.discover-entity-type-card, ' +
    '[data-chameleon-result-item], ' +
    '.org-people-profiles-module__profile-list > li',
  );

  if (specific && isSingleCard(specific)) {
    return specific;
  }

  // 2. Walk up parent elements to find the smallest container representing this single person card
  let curr: HTMLElement | null = anchorOrBtn.parentElement;
  while (curr && curr !== document.body && curr.tagName !== 'MAIN') {
    if (isInvalidCardAncestor(curr)) {
      break;
    }

    if (isSingleCard(curr)) {
      return curr;
    }

    curr = curr.parentElement;
  }

  return null;
}

function injectButtonOnCard(
  card: HTMLElement,
  anchor: HTMLAnchorElement,
  rawHref: string,
  companyNameHint: string,
) {
  if (card.querySelector('.refloop-company-people-btn')) return;

  // Extract person's name
  let fullName = '';

  // 1. Check title/heading inside card
  const titleEl = card.querySelector(
    '.org-people-profile-card__profile-title, .artdeco-entity-lockup__title, .discover-person-card__name, [data-view-name*="title"], h3, h4, h2, strong',
  );
  if (titleEl?.textContent?.trim()) {
    const candidate = cleanScrapedName(titleEl.textContent.trim());
    if (isValidPersonName(candidate)) {
      fullName = candidate;
    }
  }

  // 2. Check aria-label on anchor or card
  if (!fullName) {
    const ariaLabel = anchor.getAttribute('aria-label') || card.getAttribute('aria-label') || '';
    const ariaMatch = ariaLabel.match(/View\s+(.+?)[’']s\s+profile/i) || ariaLabel.match(/Invite\s+(.+?)\s+to\s+connect/i);
    if (ariaMatch && ariaMatch[1]) {
      const candidate = cleanScrapedName(ariaMatch[1].trim());
      if (isValidPersonName(candidate)) {
        fullName = candidate;
      }
    }
  }

  // 3. Check anchor text content directly
  if (!fullName) {
    const textContent = anchor.textContent?.trim();
    if (textContent && textContent.length > 1) {
      const candidate = cleanScrapedName(textContent);
      if (isValidPersonName(candidate)) {
        fullName = candidate;
      }
    }
  }

  if (!fullName || fullName.length < 2) return;

  // Clean profile URL (strip tracking params and hash)
  let cleanProfileUrl = rawHref.split('?')[0]!.split('#')[0]!;
  if (!cleanProfileUrl.startsWith('http')) {
    cleanProfileUrl = `https://www.linkedin.com${cleanProfileUrl}`;
  }

  // Ensure parent card container is relatively positioned
  const computedPosition = window.getComputedStyle(card).position;
  if (computedPosition === 'static') {
    card.style.position = 'relative';
  }

  // Create the floating ⚡ button
  const btn = document.createElement('button');
  btn.className = 'refloop-company-people-btn';
  btn.title = `Add ${fullName} to RefLoop`;
  btn.setAttribute('aria-label', `Add ${fullName} to RefLoop`);
  btn.innerHTML = `⚡`;

  btn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #E06D53 0%, #D97757 100%);
    color: #ffffff;
    border: 1.5px solid #FAF8F5;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.4);
    z-index: 100;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    opacity: 0.95;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.15)';
    btn.style.opacity = '1';
    btn.style.boxShadow = '0 4px 14px rgba(217, 119, 87, 0.6)';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.opacity = '0.95';
    btn.style.boxShadow = '0 2px 8px rgba(217, 119, 87, 0.4)';
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
}

export function processPeopleCards() {
  if (getLinkedInPageType() !== 'COMPANY_PEOPLE_PAGE') return;

  const { name: companyNameHint } = extractCompanySlugAndName();

  // Approach 1: Scan candidate profile links in the main content area
  const profileLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('main a[href*="/in/"], a[href*="/in/"]'),
  ).filter((a) => !a.closest('header, nav, #global-nav, .global-nav, footer'));

  let injectedCount = 0;
  profileLinks.forEach((anchor) => {
    const rawHref = anchor.getAttribute('href') || '';
    if (!rawHref.includes('/in/') || rawHref.includes('/in/unavailable/')) return;

    const card = findSingleCard(anchor);
    if (!card) {
      return;
    }

    injectButtonOnCard(card, anchor, rawHref, companyNameHint);
    injectedCount++;
  });

  // Approach 2: Scan Connect buttons in main content area
  const connectButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('main button, button'),
  ).filter((btn) => {
    if (btn.closest('header, nav, #global-nav, .global-nav, footer')) return false;
    const txt = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    return (
      txt === 'connect' ||
      txt === 'invite' ||
      aria.includes('connect') ||
      aria.includes('invite')
    );
  });

  connectButtons.forEach((btn) => {
    const card = findSingleCard(btn);
    if (!card) return;

    const inAnchor = card.querySelector<HTMLAnchorElement>('a[href*="/in/"]');
    if (!inAnchor) return;
    const rawHref = inAnchor.getAttribute('href') || '';
    if (!rawHref.includes('/in/') || rawHref.includes('/in/unavailable/')) return;

    injectButtonOnCard(card, inAnchor, rawHref, companyNameHint);
  });
}

