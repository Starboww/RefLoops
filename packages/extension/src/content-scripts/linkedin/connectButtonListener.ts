// =============================================================================
// RefLoop — LinkedIn Connect Button Listener
// Intercepts clicks on LinkedIn "Connect" / "Invite" buttons across all pages
// (profile pages, company people tabs, search results) to prompt adding candidate to RefLoop.
// =============================================================================

import { CONNECT_BUTTON_SELECTORS } from './selectors.js';
import { openRefLoopOverlay } from './profileOverlayModal.js';

let isListenerAttached = false;

export function initConnectButtonListener() {
  if (isListenerAttached) return;
  isListenerAttached = true;

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isConnect = CONNECT_BUTTON_SELECTORS.some((sel) => {
        try {
          return target.matches(sel) || target.closest(sel) !== null;
        } catch {
          return false;
        }
      }) || matchesConnectText(target);

      if (isConnect) {
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
  const card =
    target.closest(
      'li, .artdeco-card, .org-people-profile-card, [data-chameleon-result-item], .entity-result, .pv-top-card, main',
    ) || document.body;

  // Extract candidate full name from card
  let fullName: string | undefined;

  // 1. Try explicit profile link text inside card
  const titleLink = card.querySelector(
    '.org-people-profile-card__profile-title, .entity-result__title-text a, a[href*="/in/"] span[aria-hidden="true"], .pv-text-details__left-panel h1, main h1',
  );
  if (titleLink?.textContent?.trim()) {
    fullName = titleLink.textContent.trim();
  }

  if (!fullName) {
    const anyInLink = card.querySelector('a[href*="/in/"]');
    if (anyInLink?.textContent?.trim()) {
      fullName = anyInLink.textContent.trim();
    }
  }

  if (!fullName) {
    const heading = card.querySelector('h1, h2, h3, h4');
    if (heading?.textContent?.trim()) {
      fullName = heading.textContent.trim();
    }
  }

  // Fallback to "Contact"
  if (!fullName || fullName.length < 2) {
    fullName = 'Contact';
  }

  // Extract profile URL
  let profileUrl: string | undefined;
  const inAnchor = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
  if (inAnchor?.href) {
    profileUrl = inAnchor.href.split('?')[0];
  } else {
    profileUrl = window.location.href.split('?')[0];
  }

  // Extract company hint from page URL or card
  let companyNameHint: string | undefined;
  const companyMatch = window.location.pathname.match(/\/company\/([^/]+)/i);
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

