// =============================================================================
// RefLoop — LinkedIn Profile Overlay Modal & Floating Button
// Injects modal overlay on LinkedIn pages when connecting with candidates
// allowing the user to select which job posting to link this person to.
// =============================================================================

import { extractLinkedInProfileName, cleanScrapedName, isValidPersonName } from './selectors.js';
import { getLinkedInPageType } from './pageClassifier.js';

let modalContainer: HTMLDivElement | null = null;
let profileNameObserverTimer: ReturnType<typeof setInterval> | null = null;

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

function injectStyles() {
  if (document.getElementById('refloop-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'refloop-overlay-styles';
  style.textContent = `
    @keyframes refloop-pop-in {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

function injectFloatingButton() {
  if (getLinkedInPageType() !== 'PROFILE_PAGE') {
    document.getElementById('refloop-profile-floating-btn')?.remove();
    if (profileNameObserverTimer) {
      clearInterval(profileNameObserverTimer);
      profileNameObserverTimer = null;
    }
    return;
  }

  // If the overlay card is already open, don't show the floating button
  if (document.getElementById('refloop-modal-overlay-root')) {
    return;
  }

  const { firstName } = extractLinkedInProfileName();

  let button = document.getElementById('refloop-profile-floating-btn') as HTMLButtonElement | null;
  if (!button) {
    button = document.createElement('button');
    button.id = 'refloop-profile-floating-btn';
    button.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: linear-gradient(87deg, #FF3C6B 0.6%, #FF2458 96.59%);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(255, 60, 107, 0.4);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: all 0.2s ease;
    `;

    button.addEventListener('mouseover', () => {
      button!.style.opacity = '0.92';
      button!.style.transform = 'translateY(-1px)';
    });
    button.addEventListener('mouseout', () => {
      button!.style.opacity = '1';
      button!.style.transform = 'translateY(0)';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRefLoopOverlay();
    });

    document.body.appendChild(button);
  }

  button.innerHTML = `⚡ Add ${firstName} to RefLoop Job`;

  // Start short poller to update the button as soon as SPA DOM renders the top card
  if (profileNameObserverTimer) {
    clearInterval(profileNameObserverTimer);
  }
  let retries = 0;
  profileNameObserverTimer = setInterval(() => {
    retries++;
    if (!chrome.runtime?.id || getLinkedInPageType() !== 'PROFILE_PAGE') {
      if (profileNameObserverTimer) clearInterval(profileNameObserverTimer);
      return;
    }
    const current = extractLinkedInProfileName();
    const btn = document.getElementById('refloop-profile-floating-btn');
    if (btn && current.firstName && current.firstName !== 'Contact') {
      btn.innerHTML = `⚡ Add ${current.firstName} to RefLoop Job`;
      if (profileNameObserverTimer) clearInterval(profileNameObserverTimer);
    }
    if (retries >= 10 && profileNameObserverTimer) {
      clearInterval(profileNameObserverTimer);
    }
  }, 400);
}

function dismissOverlay() {
  document.querySelectorAll('#refloop-modal-overlay-root').forEach((el) => el.remove());
  modalContainer = null;
  // If on profile page, re-show floating button
  if (getLinkedInPageType() === 'PROFILE_PAGE') {
    injectFloatingButton();
  }
}

export function openRefLoopOverlay(opts: OpenOverlayOptions = {}) {
  // Ensure singleton: remove any existing RefLoop overlays from the DOM
  document.querySelectorAll('#refloop-modal-overlay-root').forEach((el) => el.remove());
  modalContainer = null;

  // Temporarily hide the profile floating button so it does not overlap
  const floatingBtn = document.getElementById('refloop-profile-floating-btn');
  if (floatingBtn) {
    floatingBtn.remove();
  }

  injectStyles();

  let fullName = opts.fullName;
  let firstName = 'Contact';

  if (!fullName || fullName === 'Contact') {
    const extracted = extractLinkedInProfileName();
    fullName = extracted.fullName;
    firstName = extracted.firstName;
  } else {
    fullName = cleanScrapedName(fullName);
    if (!isValidPersonName(fullName)) {
      const extracted = extractLinkedInProfileName();
      fullName = extracted.fullName;
      firstName = extracted.firstName;
    } else {
      firstName = fullName.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || 'Contact';
    }
  }

  const profileUrl = opts.profileUrl || window.location.href.split('?')[0]!;
  const companyHint = opts.companyNameHint || extractCompanyFromUrl();

  modalContainer = document.createElement('div');
  modalContainer.id = 'refloop-modal-overlay-root';
  // Non-blocking floating card anchored at bottom-right (does NOT cover whole screen)
  modalContainer.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 410px;
    max-width: calc(100vw - 32px);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
    pointer-events: auto;
    animation: refloop-pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: #1F2228;
    color: #FFFFFF;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 14px;
  `;

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 34px; height: 34px; background: linear-gradient(135deg, #FF3C6B 0%, #FF2458 100%); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; box-shadow: 0 2px 8px rgba(255,60,107,0.35); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.2);">⚡</div>
        <div>
          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #FFFFFF; line-height: 1.2;">Add Contact to RefLoop</h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 600; color: #FF3C6B;">Referral Outreach Pipeline</p>
        </div>
      </div>
      <button id="refloop-close-btn" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #8A919D; line-height: 1; padding: 4px; border-radius: 6px;" title="Close">✕</button>
    </div>

    <!-- Candidate Full Name & Avatar -->
    <div>
      <label style="display: block; font-size: 11px; font-weight: 600; color: #C1C6CD; margin-bottom: 5px;">Candidate Name</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <div id="refloop-avatar-initial" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #FF3C6B 0%, #FF2458 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.2);">
          ${(fullName || 'C')[0]?.toUpperCase() ?? 'C'}
        </div>
        <input id="refloop-input-fullname" type="text" value="${fullName}" placeholder="Full Name" style="flex: 1; height: 38px; min-height: 38px; line-height: 20px; box-sizing: border-box; padding: 0 12px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; font-size: 13px; background: #181B20; color: #FFFFFF; font-weight: 600; outline: none; user-select: text; -webkit-user-select: text; cursor: text;" />
      </div>
    </div>

    <div>
      <label style="display: block; font-size: 11px; font-weight: 600; color: #C1C6CD; margin-bottom: 5px;">First Name (for outreach messages)</label>
      <input id="refloop-input-firstname" type="text" value="${firstName}" placeholder="First Name" style="width: 100%; height: 38px; min-height: 38px; line-height: 20px; box-sizing: border-box; padding: 0 12px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; font-size: 13px; background: #181B20; color: #FFFFFF; font-weight: 600; outline: none; user-select: text; -webkit-user-select: text; cursor: text;" />
    </div>

    <div>
      <label style="display: block; font-size: 11px; font-weight: 600; color: #C1C6CD; margin-bottom: 5px;">Target Job Posting</label>
      <div style="position: relative;">
        <select id="refloop-select-job" style="width: 100%; height: 38px; min-height: 38px; line-height: 20px; box-sizing: border-box; padding: 0 32px 0 12px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; font-size: 13px; background-color: #181B20; background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23C1C6CD' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 10px center; color: #FFFFFF; font-weight: 600; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; -moz-appearance: none; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; display: block;">
          <option value="">Loading jobs...</option>
        </select>
      </div>
      <!-- Job detail banner to display the full job title & company clearly with word wrap -->
      <div id="refloop-selected-job-info" style="display: none; margin-top: 6px; font-size: 11px; color: #C1C6CD; background: #292E35; border: 1px solid rgba(255, 255, 255, 0.10); border-radius: 6px; padding: 6px 10px; line-height: 1.4; word-break: break-word;">
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
      <button id="refloop-cancel-btn" style="padding: 8px 14px; border: 1px solid rgba(255, 255, 255, 0.12); background: #292E35; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: #C1C6CD;">Cancel</button>
      <button id="refloop-submit-btn" style="padding: 8px 16px; border: 1px solid rgba(255, 255, 255, 0.2); background: linear-gradient(87deg, #FF3C6B 0.6%, #FF2458 96.59%); color: white; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 10px rgba(255, 60, 107, 0.3);">+ Add ${firstName} to RefLoop</button>
    </div>
  `;

  modalContainer.appendChild(card);
  document.body.appendChild(modalContainer);

  const closeBtn = card.querySelector('#refloop-close-btn');
  const cancelBtn = card.querySelector('#refloop-cancel-btn');
  closeBtn?.addEventListener('click', dismissOverlay);
  cancelBtn?.addEventListener('click', dismissOverlay);

  const fullNameInput = card.querySelector('#refloop-input-fullname') as HTMLInputElement | null;
  const firstNameInput = card.querySelector('#refloop-input-firstname') as HTMLInputElement | null;
  const avatarEl = card.querySelector('#refloop-avatar-initial') as HTMLDivElement | null;
  const submitBtn = card.querySelector('#refloop-submit-btn') as HTMLButtonElement | null;
  const selectJobEl = card.querySelector('#refloop-select-job') as HTMLSelectElement | null;

  // Stop propagation on inputs so LinkedIn shortcuts don't intercept typing
  [fullNameInput, firstNameInput, selectJobEl].forEach((el) => {
    if (!el) return;
    el.addEventListener('keydown', (e) => e.stopPropagation());
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('keypress', (e) => e.stopPropagation());
  });

  let userEditedFirstNameManually = false;

  fullNameInput?.addEventListener('input', () => {
    const rawVal = fullNameInput.value.trim();
    if (avatarEl) {
      avatarEl.innerText = (rawVal[0] || 'C').toUpperCase();
    }
    if (!userEditedFirstNameManually && firstNameInput) {
      const derived = rawVal.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || rawVal;
      firstNameInput.value = derived;
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.innerText = `+ Add ${derived || 'Contact'} to RefLoop`;
      }
    }
  });

  firstNameInput?.addEventListener('input', () => {
    userEditedFirstNameManually = true;
    const val = firstNameInput.value.trim();
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.innerText = `+ Add ${val || 'Contact'} to RefLoop`;
    }
  });

  // Fetch active jobs and contacts from storage & pre-select company match if found
  void (async () => {
    try {
      const result = await chrome.storage.local.get(['jobs:v1', 'contacts:v1']);
      const jobs = (result['jobs:v1'] as Array<{ id: string; companyName: string; jobTitle: string; status: string }>) ?? [];
      const contacts = (result['contacts:v1'] as Array<{ jobPostingId: string; channel?: string; linkedinProfileUrl?: string; removedAt?: string }>) ?? [];
      const activeJobs = jobs.filter((j) => j.status === 'ACTIVE');

      const selectEl = card.querySelector('#refloop-select-job') as HTMLSelectElement | null;
      const jobInfoEl = card.querySelector('#refloop-selected-job-info') as HTMLDivElement | null;
      if (!selectEl) return;

      const normTargetUrl = profileUrl.split('?')[0]!.split('#')[0]!.toLowerCase().replace(/\/+$/, '');

      const isAlreadyAddedToJob = (targetJobId: string): boolean => {
        return contacts.some((c) => {
          if (c.jobPostingId !== targetJobId || c.removedAt) return false;
          if (!c.linkedinProfileUrl) return false;
          const normC = c.linkedinProfileUrl.split('?')[0]!.split('#')[0]!.toLowerCase().replace(/\/+$/, '');
          return normC === normTargetUrl || normC.endsWith(normTargetUrl) || normTargetUrl.endsWith(normC);
        });
      };

      const updateJobInfoDisplay = () => {
        if (!jobInfoEl) return;
        const currentId = selectEl.value;
        const matched = activeJobs.find((j) => j.id === currentId);
        const alreadyAdded = isAlreadyAddedToJob(currentId);

        if (matched) {
          jobInfoEl.style.display = 'block';
          if (alreadyAdded) {
            jobInfoEl.innerHTML = `
              <div style="color: #DD2C61; font-weight: 700; margin-bottom: 2px;">⚠️ Already added to this job posting</div>
              <span style="color: #FF3C6B; font-weight: 700;">💼 Target Job:</span> <strong style="color: #FFFFFF;">${matched.companyName}</strong> — ${matched.jobTitle}
            `;
            if (submitBtn) {
              submitBtn.disabled = true;
              submitBtn.style.opacity = '0.5';
              submitBtn.innerText = 'Already in RefLoop Job';
            }
          } else {
            jobInfoEl.innerHTML = `<span style="color: #FF3C6B; font-weight: 700;">💼 Target Job:</span> <strong style="color: #FFFFFF;">${matched.companyName}</strong> — ${matched.jobTitle}`;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
              const curFirst = (card.querySelector('#refloop-input-firstname') as HTMLInputElement)?.value.trim() || firstName;
              submitBtn.innerText = `+ Add ${curFirst} to RefLoop`;
            }
          }
        } else {
          jobInfoEl.style.display = 'none';
        }
      };

      selectEl.addEventListener('change', updateJobInfoDisplay);

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

        updateJobInfoDisplay();
      }
    } catch {
      const selectEl = card.querySelector('#refloop-select-job') as HTMLSelectElement | null;
      if (selectEl) selectEl.innerHTML = '<option value="">Failed to load jobs</option>';
    }
  })();

  submitBtn?.addEventListener('click', () => {
    const fullNameVal = (card.querySelector('#refloop-input-fullname') as HTMLInputElement)?.value?.trim();
    const firstNameVal = (card.querySelector('#refloop-input-firstname') as HTMLInputElement)?.value?.trim();
    const jobIdVal = (card.querySelector('#refloop-select-job') as HTMLSelectElement)?.value;

    if (!jobIdVal) {
      alert('Please select a target job posting!');
      return;
    }

    const finalFirstName = firstNameVal || firstName || 'Contact';
    const finalFullName = fullNameVal || fullName || finalFirstName;

    submitBtn.innerText = 'Adding Contact...';
    submitBtn.disabled = true;

    if (!chrome.runtime?.id) {
      alert('RefLoop extension context was invalidated (e.g. extension updated). Please refresh the page!');
      submitBtn.innerText = `+ Add ${finalFirstName} to RefLoop`;
      submitBtn.disabled = false;
      return;
    }

    void chrome.runtime.sendMessage(
      {
        type: 'ADD_LINKEDIN_CONTACT_REQUEST',
        payload: {
          jobPostingId: jobIdVal,
          firstName: finalFirstName,
          linkedinProfileUrl: profileUrl,
          fullNameRaw: finalFullName,
        },
      },
      (res: { success?: boolean; error?: string } | undefined) => {
        dismissOverlay();
        if (chrome.runtime.lastError) {
          console.warn('[RefLoop] Error adding contact:', chrome.runtime.lastError.message);
          alert('Could not communicate with RefLoop extension background script. Please refresh the page.');
          return;
        }
        if (res?.success) {
          showToast(`✓ Added ${finalFirstName} to RefLoop job!`);
        } else {
          showToast(`⚠️ ${res?.error ?? 'Could not add contact'}`);
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
  document.querySelectorAll('.refloop-action-toast').forEach((t) => t.remove());
  const toast = document.createElement('div');
  toast.className = 'refloop-action-toast';
  toast.innerText = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 20px;
    background-color: #1F2228;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

