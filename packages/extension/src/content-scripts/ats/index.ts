// =============================================================================
// RefLoop — ATS Content Script Entry Point
// Injects an "Add to RefLoop" button on recognized ATS job posting pages.
// =============================================================================

import { detectATS } from './atsDetector.js';

const result = detectATS(window.location.href);

if (result) {
  setTimeout(() => {
    injectATSButton(result);
  }, 1000);
}

function injectATSButton(atsInfo: ReturnType<typeof detectATS> & {}) {
  if (document.getElementById('refloop-ats-btn')) return;

  const button = document.createElement('button');
  button.id = 'refloop-ats-btn';
  button.innerHTML = `⚡ Add to RefLoop (${atsInfo.ats})`;
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 10px 18px;
    background-color: #D97757;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(217,119,87,0.35);
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: all 0.2s ease;
  `;

  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#C86545';
  });
  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#D97757';
  });

  button.addEventListener('click', () => {
    let jobTitle = document.title.split('|')[0]?.split('-')[0]?.split('–')[0]?.trim() ?? 'Job Posting';
    const h1 = document.querySelector('h1');
    if (h1?.textContent?.trim()) {
      jobTitle = h1.textContent.trim();
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
          companyName: atsInfo.companyNameFromUrl,
          jobTitle,
          jobLink: window.location.href,
          sourceType: 'COMPANY_SITE',
          companyJobId: atsInfo.companyJobId,
        },
      },
      (_res: { success?: boolean } | undefined) => {
        if (chrome.runtime.lastError) {
          console.warn('[RefLoop] Error sending ATS job request:', chrome.runtime.lastError.message);
          return;
        }
        showSuccessToast(atsInfo.companyNameFromUrl, jobTitle);
      },
    );
  });

  document.body.appendChild(button);
}

function showSuccessToast(company: string, title: string) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 72px;
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
