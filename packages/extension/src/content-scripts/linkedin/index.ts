// =============================================================================
// RefLoop — LinkedIn Content Script Entry Point
// Loaded on all linkedin.com/* pages. Conditionally activates features
// based on whether the current page is a job posting, person profile, or company page.
// =============================================================================

import './composerAutomation'; // Always active — listens for PASTE_AND_SEND
import { getLinkedInPageType } from './pageClassifier';
import { initProfileOverlay } from './profileOverlayModal';
import { initAddToTracker } from './addToTrackerInjector';
import { initConnectButtonListener } from './connectButtonListener';
import { readCurrentJobDetails } from './jobDetailsReader';
import { initJobsFloatingWidget, destroyWidget, onJobIdChange } from './jobsFloatingWidget';

// ---------------------------------------------------------------------------
// Popup → Content Script bridge: GET_CURRENT_JOB_DETAILS
// The popup cannot read the DOM directly, so it asks the content script.
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    message !== null &&
    typeof message === 'object' &&
    (message as Record<string, unknown>)['type'] === 'GET_CURRENT_JOB_DETAILS'
  ) {
    void readCurrentJobDetails().then((details) => {
      sendResponse({ success: true, details });
    });
    return true; // keep message channel open for async response
  }
  return false;
});

function handleRoute() {
  const pageType = getLinkedInPageType();

  if (pageType === 'PROFILE_PAGE') {
    // Clean up job buttons when navigating to a profile page
    document.getElementById('refloop-job-injector-btn')?.remove();
    destroyWidget();
    initProfileOverlay();
  } else if (pageType === 'JOB_PAGE') {
    // Clean up profile floating button when navigating to a job page
    document.getElementById('refloop-profile-floating-btn')?.remove();
    initAddToTracker();
    initJobsFloatingWidget();
  } else {
    // Clean up all injected elements on other pages
    document.getElementById('refloop-job-injector-btn')?.remove();
    document.getElementById('refloop-profile-floating-btn')?.remove();
    destroyWidget();
  }

  // Always activate Connect button listener across all LinkedIn pages
  initConnectButtonListener();
}

// Initial route handle
handleRoute();

// Handle SPA route changes
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return;

  // Capture previous state BEFORE updating lastUrl
  const prevJobId  = new URL(lastUrl).searchParams.get('currentJobId') ?? '';
  const prevPath   = new URL(lastUrl).pathname;
  lastUrl = currentUrl;
  const newJobId   = new URL(currentUrl).searchParams.get('currentJobId') ?? '';
  const newPath    = new URL(currentUrl).pathname;

  // Path changed (e.g. /jobs → /in/) — full route re-init
  if (prevPath !== newPath) {
    handleRoute();
    return;
  }

  // Same path, different currentJobId — just refresh the widget panel content
  if (getLinkedInPageType() === 'JOB_PAGE' && newJobId !== prevJobId) {
    onJobIdChange(newJobId);
    return;
  }

  // Full re-init for anything else
  handleRoute();
});
observer.observe(document.body, { subtree: true, childList: true });


