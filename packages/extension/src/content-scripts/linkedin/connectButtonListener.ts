// =============================================================================
// RefLoop — LinkedIn Connect Button Listener
// Intercepts clicks on LinkedIn "Connect" / "Invite" buttons across all pages
// (profile pages, company people tabs, search results) to prompt adding candidate to RefLoop.
// =============================================================================

import { CONNECT_BUTTON_SELECTORS, extractLinkedInProfileName, cleanScrapedName, isValidPersonName } from './selectors.js';
import { openRefLoopOverlay } from './profileOverlayModal.js';
import { getLinkedInPageType } from './pageClassifier.js';

const _win = window as unknown as { __refloop_connect_listener_attached__?: boolean };
let lastConnectClickTime = 0;

export function initConnectButtonListener() {
  if (_win.__refloop_connect_listener_attached__) return;
  _win.__refloop_connect_listener_attached__ = true;

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore any clicks originating inside RefLoop's own UI elements
      if (
        target.closest(
          '#refloop-modal-overlay-root, #refloop-jobs-floating-widget, #refloop-profile-floating-btn, .refloop-company-people-btn, #refloop-job-injector-btn',
        )
      ) {
        return;
      }

      const isConnect =
        CONNECT_BUTTON_SELECTORS.some((sel) => {
          try {
            return target.matches(sel) || target.closest(sel) !== null;
          } catch {
            return false;
          }
        }) || matchesConnectText(target);

      if (isConnect) {
        // Debounce to prevent multiple triggers from fast clicks / bubbling / duplicate events
        const now = Date.now();
        if (now - lastConnectClickTime < 1500) {
          return;
        }
        lastConnectClickTime = now;

        handleConnectClick(target);
      }
    },
    true,
  );
}

function matchesConnectText(target: HTMLElement): boolean {
  try {
    const text = (target.textContent || '').trim();
    const aria = target.getAttribute('aria-label') || '';
    const isButtonOrSpan =
      target.tagName === 'BUTTON' ||
      target.tagName === 'SPAN' ||
      target.closest('button') !== null;

    if (!isButtonOrSpan) return false;

    return (
      /^connect$/i.test(text) ||
      /^invite$/i.test(text) ||
      /connect/i.test(aria) ||
      /invite.*to connect/i.test(aria)
    );
  } catch {
    return false;
  }
}

function handleConnectClick(target: HTMLElement) {
  // Find card container enclosing the clicked Connect button
  const isProfilePage = getLinkedInPageType() === 'PROFILE_PAGE';
  const isMainTopCard =
    isProfilePage &&
    (target.closest('.pv-top-card, main section:first-of-type, .ph5') !== null ||
      !target.closest('aside, .right-rail, [data-view-name*="sidebar"], [data-view-name*="more-profiles"]'));

  let fullName: string | undefined;
  let profileUrl: string | undefined;

  // 1. First priority: Check aria-label on the clicked button or its closest button element
  const buttonEl = (target.tagName === 'BUTTON' ? target : target.closest('button')) as HTMLButtonElement | null;
  const btnAria = buttonEl?.getAttribute('aria-label') || target.getAttribute('aria-label') || '';

  if (btnAria) {
    const inviteMatch =
      btnAria.match(/^Invite\s+(.+?)\s+to\s+connect/i) ||
      btnAria.match(/^Connect\s+with\s+(.+)/i) ||
      btnAria.match(/^Invite\s+(.+)/i) ||
      btnAria.match(/^Message\s+(.+)/i);
    if (inviteMatch && inviteMatch[1]) {
      const candidate = cleanScrapedName(inviteMatch[1].trim());
      if (isValidPersonName(candidate)) {
        fullName = candidate;
      }
    }
  }

  if (isProfilePage && isMainTopCard) {
    const extracted = extractLinkedInProfileName();
    if (!fullName) fullName = extracted.fullName;
    profileUrl = window.location.href.split('?')[0];
  } else {
    const card =
      target.closest<HTMLElement>(
        'li.org-people-profiles-module__profile-item, ' +
        'li.org-people-profile-card__profile-card-spacing, ' +
        '.org-people-profile-card, ' +
        '[data-view-name*="profile-card"], ' +
        '[data-chameleon-result-item], ' +
        '.entity-result, ' +
        'li.artdeco-list__item, ' +
        'li.grid__col, ' +
        '.discover-entity-type-card, ' +
        'li, .artdeco-card, .pv-top-card',
      ) || target.parentElement || document.body;

    // 2. Find profile anchors inside this specific person card
    const allInAnchors = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')).filter((a) => {
      const href = a.getAttribute('href') || '';
      const aria = a.getAttribute('aria-label') || '';
      const text = a.textContent || '';
      return (
        !href.includes('/in/unavailable/') &&
        !aria.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('connection') &&
        !text.toLowerCase().includes('other')
      );
    });

    if (!fullName) {
      // 3. Try explicit profile title inside card
      const titleEl = card.querySelector(
        '.org-people-profile-card__profile-title, .artdeco-entity-lockup__title, .entity-result__title-text a, .pv-text-details__left-panel h1, .pv-text-details__left-panel h2, h2, h3, h4, strong',
      );
      if (titleEl?.textContent?.trim()) {
        const candidate = cleanScrapedName(titleEl.textContent.trim());
        if (isValidPersonName(candidate)) {
          fullName = candidate;
        }
      }
    }

    if (!fullName && allInAnchors.length > 0) {
      for (const inAnchor of allInAnchors) {
        // Try anchor aria-label (e.g. "View Tanmay Mandal’s profile")
        const anchorAria = inAnchor.getAttribute('aria-label') || '';
        const ariaMatch = anchorAria.match(/View\s+(.+?)[’']s\s+profile/i);
        if (ariaMatch && ariaMatch[1]) {
          const candidate = cleanScrapedName(ariaMatch[1].trim());
          if (isValidPersonName(candidate)) {
            fullName = candidate;
            break;
          }
        }

        const candidate = cleanScrapedName(inAnchor.textContent?.trim() || '');
        if (isValidPersonName(candidate)) {
          fullName = candidate;
          break;
        }
      }
    }

    // Determine clean profile URL
    const primaryAnchor = allInAnchors[0];
    if (primaryAnchor?.href) {
      profileUrl = primaryAnchor.href.split('?')[0];
    } else {
      profileUrl = window.location.href.split('?')[0];
    }
  }

  // Fallback to "Contact"
  if (!fullName || fullName.length < 2) {
    fullName = 'Contact';
  }

  // Extract company hint from page URL or card
  let companyNameHint: string | undefined;
  const companyMatch = window.location.pathname.match(/\/(?:company|school)\/([^/]+)/i);
  if (companyMatch && companyMatch[1]) {
    companyNameHint = companyMatch[1].replace(/-/g, ' ');
  }

  // Small delay so LinkedIn's native DOM updates cleanly before modal opens
  setTimeout(() => {
    openRefLoopOverlay({
      fullName,
      profileUrl,
      companyNameHint,
    });
  }, 250);
}

