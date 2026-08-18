// =============================================================================
// RefLoop — LinkedIn Content Script Entry Point
// Loaded on all linkedin.com/* pages. Conditionally activates features
// based on whether the current page is a job posting, person profile, or company page.
//
// IMPORTANT: This script must be fully idempotent. The background service worker
// may re-inject it via chrome.scripting.executeScript after extension reload/update
// when the previously-injected instance has been orphaned (chrome.runtime.id = undefined).
// =============================================================================

import './composerAutomation'; // Always active — listens for PASTE_AND_SEND
import { getLinkedInPageType } from './pageClassifier';
import { initProfileOverlay } from './profileOverlayModal';
import { initAddToTracker } from './addToTrackerInjector';
import { initConnectButtonListener } from './connectButtonListener';
import { readCurrentJobDetails } from './jobDetailsReader';
import { initJobsFloatingWidget, destroyWidget, onJobIdChange } from './jobsFloatingWidget';
import { initCompanyPeopleInjector, destroyCompanyPeopleInjector } from './companyPeopleInjector';

// ---------------------------------------------------------------------------
// Idempotent cleanup: If a previous injection left behind timers/observers,
// clear them before we set up new ones. This handles extension reload scenarios.
// ---------------------------------------------------------------------------
interface RefLoopWindowState {
  __refloop_heartbeat__?: ReturnType<typeof setInterval> | undefined;
  __refloop_route_observer__?: MutationObserver | undefined;
}
const _win = window as unknown as RefLoopWindowState;

if (_win.__refloop_heartbeat__) {
  clearInterval(_win.__refloop_heartbeat__);
  _win.__refloop_heartbeat__ = undefined;
}
if (_win.__refloop_route_observer__) {
  _win.__refloop_route_observer__.disconnect();
  _win.__refloop_route_observer__ = undefined;
}

// ---------------------------------------------------------------------------
// Background / Popup → Content Script bridge
// 1. REFLOOP_NAVIGATED: Triggered on SPA pushState / history changes via chrome.webNavigation
// 2. GET_CURRENT_JOB_DETAILS: The popup asks content script for current job DOM details
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (message !== null && typeof message === 'object') {
    const msg = message as Record<string, unknown>;

    if (msg['type'] === 'REFLOOP_NAVIGATED') {
      const targetUrl = (msg['url'] as string) || window.location.href;
      checkRoute(true, targetUrl);
      return;
    }

    if (msg['type'] === 'GET_CURRENT_JOB_DETAILS') {
      void readCurrentJobDetails().then((details) => {
        sendResponse({ success: true, details });
      });
      return true; // keep message channel open for async response
    }
  }
  return false;
});

function handleRoute() {
  const pageType = getLinkedInPageType();

  if (pageType === 'PROFILE_PAGE') {
    document.getElementById('refloop-job-injector-btn')?.remove();
    destroyCompanyPeopleInjector();
    destroyWidget();
    initProfileOverlay();
  } else if (pageType === 'JOB_PAGE') {
    document.getElementById('refloop-profile-floating-btn')?.remove();
    destroyCompanyPeopleInjector();
    initAddToTracker();
    initJobsFloatingWidget();
  } else if (pageType === 'COMPANY_PEOPLE_PAGE') {
    document.getElementById('refloop-job-injector-btn')?.remove();
    document.getElementById('refloop-profile-floating-btn')?.remove();
    destroyWidget();
    initCompanyPeopleInjector();
  } else {
    document.getElementById('refloop-job-injector-btn')?.remove();
    document.getElementById('refloop-profile-floating-btn')?.remove();
    destroyCompanyPeopleInjector();
    destroyWidget();
  }

  // Always activate Connect button listener across all LinkedIn pages
  initConnectButtonListener();
}

// ---------------------------------------------------------------------------
// SPA Route Change & Navigation Watcher
// ---------------------------------------------------------------------------
let lastUrl = window.location.href;
let lastPageType = getLinkedInPageType();

function checkRoute(force = false, explicitUrl?: string) {
  const currentUrl = explicitUrl || window.location.href;
  const currentPageType = getLinkedInPageType(currentUrl);

  if (!force && currentUrl === lastUrl && currentPageType === lastPageType) {
    return;
  }

  const prevUrl = lastUrl;
  const prevPageType = lastPageType;
  lastUrl = currentUrl;
  lastPageType = currentPageType;

  try {
    const prevParsed = new URL(prevUrl);
    const currParsed = new URL(currentUrl);
    const prevJobId = prevParsed.searchParams.get('currentJobId') ?? '';
    const newJobId = currParsed.searchParams.get('currentJobId') ?? '';
    const prevPath = prevParsed.pathname;
    const newPath = currParsed.pathname;

    if (
      currentPageType === 'JOB_PAGE' &&
      prevPageType === 'JOB_PAGE' &&
      prevPath === newPath &&
      newJobId !== prevJobId
    ) {
      onJobIdChange(newJobId);
      return;
    }
  } catch {
    // fallback to full handleRoute
  }

  handleRoute();
}

// 1. Initial route handle
handleRoute();

// 2. DOM Mutation Observer (stored on window for idempotent cleanup on re-inject)
const routeObserver = new MutationObserver(() => {
  if (!chrome.runtime?.id) {
    routeObserver.disconnect();
    return;
  }
  checkRoute();
});
routeObserver.observe(document.body, { subtree: true, childList: true });
_win.__refloop_route_observer__ = routeObserver;

// 3. Browser History Events
window.addEventListener('popstate', () => {
  if (!chrome.runtime?.id) return;
  checkRoute(true);
});
window.addEventListener('hashchange', () => {
  if (!chrome.runtime?.id) return;
  checkRoute(true);
});

// 4. Click Listener on Navigation & Tab Links
document.addEventListener(
  'click',
  (e) => {
    if (!chrome.runtime?.id) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const isNavLink =
      target.closest('a') !== null ||
      target.closest('button') !== null ||
      target.closest('[role="tab"]') !== null ||
      target.closest('.org-page-navigation') !== null ||
      target.closest('.artdeco-tab') !== null;

    if (isNavLink) {
      setTimeout(() => { if (chrome.runtime?.id) checkRoute(); }, 50);
      setTimeout(() => { if (chrome.runtime?.id) checkRoute(); }, 200);
      setTimeout(() => { if (chrome.runtime?.id) checkRoute(); }, 500);
    }
  },
  true,
);

// 5. Polling Heartbeat (stored on window for idempotent cleanup on re-inject)
const heartbeatTimer = setInterval(() => {
  if (!chrome.runtime?.id) {
    clearInterval(heartbeatTimer);
    routeObserver.disconnect();
    return;
  }
  checkRoute();
}, 300);
_win.__refloop_heartbeat__ = heartbeatTimer;

console.log('[RefLoop] Content script initialized, pageType=', lastPageType);
