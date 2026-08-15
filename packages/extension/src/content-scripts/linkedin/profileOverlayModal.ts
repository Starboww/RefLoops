// =============================================================================
// RefLoop — LinkedIn Profile Overlay Modal & Floating Button
// Injects modal overlay on LinkedIn pages when connecting with candidates
// allowing the user to select which job posting to link this person to.
// =============================================================================

import { PROFILE_NAME_SELECTORS, queryFirst } from './selectors.js';
import { getLinkedInPageType } from './pageClassifier.js';

let modalContainer: HTMLDivElement | null = null;

export interface OpenOverlayOptions {
  fullName?: string | undefined;
  profileUrl?: string | undefined;
  companyNameHint?: string | undefined;
}

export function initProfileOverlay() {
  if (getLinkedInPageType() === 'PROFILE_PAGE') {
    injectFloatingButton();
  }
}

function injectFloatingButton() {
  if (getLinkedInPageType() !== 'PROFILE_PAGE') {
    document.getElementById('refloop-profile-floating-btn')?.remove();
    return;
  }

  if (document.getElementById('refloop-profile-floating-btn')) return;

  const nameEl = queryFirst(PROFILE_NAME_SELECTORS);
  const fullName = nameEl?.textContent?.trim() ?? 'Contact';
  const firstName = fullName.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') ?? 'Contact';

  const button = document.createElement('button');
  button.id = 'refloop-profile-floating-btn';
  button.innerHTML = `⚡ Add ${firstName} to RefLoop Job`;
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background-color: #D97757;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(217, 119, 87, 0.4);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: all 0.2s ease;
  `;

  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#C86545';
    button.style.transform = 'translateY(-1px)';
  });
  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#D97757';
    button.style.transform = 'translateY(0)';
  });

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openRefLoopOverlay();
  });

  document.body.appendChild(button);
}

export function openRefLoopOverlay(opts: OpenOverlayOptions = {}) {
  if (modalContainer) {
    modalContainer.remove();
  }

  let fullName = opts.fullName;
  if (!fullName) {
    const nameEl = queryFirst(PROFILE_NAME_SELECTORS);
    fullName = nameEl?.textContent?.trim() ?? 'Contact';
  }
  // Clean raw full name
  fullName = fullName.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const firstName = fullName.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || 'Contact';

  const profileUrl = opts.profileUrl || window.location.href.split('?')[0]!;
  const companyHint = opts.companyNameHint || extractCompanyFromUrl();

  modalContainer = document.createElement('div');
  modalContainer.id = 'refloop-modal-overlay-root';
  modalContainer.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: #FAF8F5;
    color: #1C1917;
    border: 1px solid #E8E3DA;
    border-radius: 20px;
    padding: 24px;
    width: 440px;
    max-width: calc(100vw - 32px);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #E06D53 0%, #D97757 100%); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; shadow: 0 2px 8px rgba(217,119,87,0.4);">⚡</div>
        <div>
          <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: #1C1917; line-height: 1.2;">Add Contact to RefLoop</h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 600; color: #D97757;">RefLoop Referral Outreach Pipeline</p>
        </div>
      </div>
      <button id="refloop-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #A8A29E; line-height: 1; padding: 4px;" title="Close">✕</button>
    </div>

    <!-- Candidate Preview Card -->
    <div style="background: #F4F0EA; border: 1px solid #E8E3DA; border-radius: 12px; padding: 12px 14px; display: flex; items-center; gap: 12px;">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: #D97757; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; shrink: 0;">
        ${firstName[0]?.toUpperCase() ?? 'C'}
      </div>
      <div style="overflow: hidden; flex: 1;">
        <div style="font-weight: 700; font-size: 14px; color: #1C1917; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fullName}</div>
        <div style="font-size: 11px; color: #78716C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">LinkedIn Profile</div>
      </div>
    </div>

    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: #78716C; margin-bottom: 6px;">First Name</label>
      <input id="refloop-input-firstname" type="text" value="${firstName}" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #E8E3DA; border-radius: 10px; font-size: 13px; background: white; color: #1C1917; font-weight: 500; outline: none;" />
    </div>

    <div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: #78716C; margin-bottom: 6px;">Target Job Posting</label>
      <select id="refloop-select-job" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #E8E3DA; border-radius: 10px; font-size: 13px; background: white; color: #1C1917; font-weight: 500; outline: none; cursor: pointer;">
        <option value="">Loading jobs...</option>
      </select>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
      <button id="refloop-cancel-btn" style="padding: 9px 18px; border: 1px solid #E8E3DA; background: white; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; color: #78716C;">Cancel</button>
      <button id="refloop-submit-btn" style="padding: 9px 20px; border: none; background: #D97757; color: white; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(217, 119, 87, 0.3);">+ Add ${firstName} to RefLoop</button>
    </div>
  `;

  modalContainer.appendChild(card);
  document.body.appendChild(modalContainer);

  const closeBtn = card.querySelector('#refloop-close-btn');
  const cancelBtn = card.querySelector('#refloop-cancel-btn');
  closeBtn?.addEventListener('click', () => modalContainer?.remove());
  cancelBtn?.addEventListener('click', () => modalContainer?.remove());

  // Fetch active jobs from storage & pre-select company match if found
  void (async () => {
    try {
      const result = await chrome.storage.local.get('jobs:v1');
      const jobs = (result['jobs:v1'] as Array<{ id: string; companyName: string; jobTitle: string; status: string }>) ?? [];
      const activeJobs = jobs.filter((j) => j.status === 'ACTIVE');

      const selectEl = card.querySelector('#refloop-select-job') as HTMLSelectElement | null;
      if (!selectEl) return;

      if (activeJobs.length === 0) {
        selectEl.innerHTML = '<option value="">No active jobs in RefLoop. Create one first!</option>';
      } else {
        selectEl.innerHTML = activeJobs
          .map((j) => `<option value="${j.id}">${j.companyName} — ${j.jobTitle}</option>`)
          .join('');

        // Try auto-selecting company hint match
        if (companyHint) {
          const matchIndex = activeJobs.findIndex((j) =>
            j.companyName.toLowerCase().includes(companyHint.toLowerCase()) ||
            companyHint.toLowerCase().includes(j.companyName.toLowerCase())
          );
          if (matchIndex >= 0) {
            selectEl.selectedIndex = matchIndex;
          }
        }
      }
    } catch {
      const selectEl = card.querySelector('#refloop-select-job') as HTMLSelectElement | null;
      if (selectEl) selectEl.innerHTML = '<option value="">Failed to load jobs</option>';
    }
  })();

  const submitBtn = card.querySelector('#refloop-submit-btn') as HTMLButtonElement | null;
  submitBtn?.addEventListener('click', () => {
    const firstNameVal = (card.querySelector('#refloop-input-firstname') as HTMLInputElement)?.value;
    const jobIdVal = (card.querySelector('#refloop-select-job') as HTMLSelectElement)?.value;

    if (!jobIdVal) {
      alert('Please select a target job posting!');
      return;
    }

    submitBtn.innerText = 'Adding Contact...';
    submitBtn.disabled = true;

    if (!chrome.runtime?.id) {
      alert('RefLoop extension context was invalidated (e.g. extension updated). Please refresh the page!');
      submitBtn.innerText = `+ Add ${firstName} to RefLoop`;
      submitBtn.disabled = false;
      return;
    }

    void chrome.runtime.sendMessage(
      {
        type: 'ADD_LINKEDIN_CONTACT_REQUEST',
        payload: {
          jobPostingId: jobIdVal,
          firstName: firstNameVal || firstName,
          linkedinProfileUrl: profileUrl,
          fullNameRaw: fullName,
        },
      },
      (res: { success?: boolean; error?: string } | undefined) => {
        modalContainer?.remove();
        if (chrome.runtime.lastError) {
          console.warn('[RefLoop] Error adding contact:', chrome.runtime.lastError.message);
          alert('Could not communicate with RefLoop extension background script. Please refresh the page.');
          return;
        }
        if (res?.success) {
          showToast(`✓ Added ${firstNameVal || firstName} to RefLoop job!`);
        } else {
          alert(`Could not add contact: ${res?.error ?? 'Unknown error'}`);
        }
      },
    );
  });
}

function extractCompanyFromUrl(): string | undefined {
  const match = window.location.pathname.match(/\/company\/([^/]+)/i);
  if (match && match[1]) {
    return match[1].replace(/-/g, ' ');
  }
  return undefined;
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 20px;
    background-color: #1C1917;
    color: white;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

