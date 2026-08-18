// =============================================================================
// RefLoop — LinkedIn Add to Tracker Injector
// Injects an "Add to RefLoop" button ONLY on LinkedIn job posting pages.
// PRD §8.1: Easy Apply vs Company Site detection.
// =============================================================================

import {
  EASY_APPLY_BUTTON_SELECTORS,
  JOB_TITLE_SELECTORS,
  COMPANY_NAME_SELECTORS,
  COMPANY_LINK_SELECTOR,
  queryFirst,
} from './selectors.js';
import { getLinkedInPageType } from './pageClassifier.js';

export function initAddToTracker() {
  // If not a job page, remove any leftover button and exit
  if (getLinkedInPageType() !== 'JOB_PAGE') {
    document.getElementById('refloop-job-injector-btn')?.remove();
    return;
  }

  // Try injecting immediately and retry up to 5 times for dynamic SPA loads
  let retries = 0;
  const timer = setInterval(() => {
    retries++;
    if (!chrome.runtime?.id) {
      clearInterval(timer);
      return;
    }
    const injected = injectButton();
    if (injected || retries >= 5) {
      clearInterval(timer);
    }
  }, 800);
}

function injectButton(): boolean {
  // Re-verify strictly that we are on a job page
  if (getLinkedInPageType() !== 'JOB_PAGE') {
    document.getElementById('refloop-job-injector-btn')?.remove();
    return true;
  }

  if (document.getElementById('refloop-job-injector-btn')) return true;

  // Use ONLY strict job title selectors — NEVER generic h1
  const jobTitleEl = queryFirst(JOB_TITLE_SELECTORS);
  if (!jobTitleEl) return false;

  const companyNameEl = queryFirst(COMPANY_NAME_SELECTORS);

  const button = document.createElement('button');
  button.id = 'refloop-job-injector-btn';
  button.innerHTML = '⚡ Add to RefLoop';
  button.style.cssText = `
    margin-left: 12px;
    padding: 6px 14px;
    background-color: #D97757;
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(217,119,87,0.3);
    z-index: 9999;
    vertical-align: middle;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const jobTitle = jobTitleEl.textContent?.trim() ?? 'Job Posting';

    const companyLink = queryFirst([COMPANY_LINK_SELECTOR]) as HTMLAnchorElement | null;
    let companyName = companyNameEl?.textContent?.trim();
    if (!companyName && companyLink?.textContent?.trim()) {
      companyName = companyLink.textContent.trim();
    }
    if (!companyName) companyName = 'Company';

    const jobLink = window.location.href.split('?')[0]!;

    const isEasyApply = queryFirst(EASY_APPLY_BUTTON_SELECTORS) !== null;
    const sourceType = isEasyApply ? 'EASY_APPLY' : 'COMPANY_SITE';

    let companyLinkedInSlug: string | undefined;
    if (companyLink?.href) {
      const match = companyLink.href.match(/\/company\/([^/]+)/);
      if (match) companyLinkedInSlug = match[1];
    }

    button.innerHTML = '✓ Added to RefLoop!';
    button.style.backgroundColor = '#059669';

    if (!chrome.runtime?.id) {
      console.warn('[RefLoop] Extension context invalidated. Please refresh the page.');
      return;
    }

    void chrome.runtime.sendMessage(
      {
        type: 'ADD_JOB_REQUEST',
        payload: {
          companyName,
          jobTitle,
          jobLink,
          sourceType,
          companyLinkedInSlug,
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('[RefLoop] Message send error:', chrome.runtime.lastError.message);
          return;
        }
        showSuccessToast(companyName, jobTitle);
      },
    );
  });

  jobTitleEl.appendChild(button);
  return true;
}

function showSuccessToast(company: string, title: string) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 14px 20px;
    background-color: #1C1917;
    color: white;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  toast.innerHTML = `
    <div>
      <div style="font-weight: 700; color: #10B981;">✓ Job Added to RefLoop!</div>
      <div style="font-size: 11px; color: #A8A29E;">${title} at ${company}</div>
    </div>
    <button id="refloop-toast-dash-btn" style="padding: 6px 12px; background: #D97757; color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Open Dashboard ↗</button>
  `;

  document.body.appendChild(toast);

  const dashBtn = toast.querySelector('#refloop-toast-dash-btn');
  dashBtn?.addEventListener('click', () => {
    void chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    toast.remove();
  });

  setTimeout(() => toast.remove(), 6000);
}
