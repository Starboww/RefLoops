// =============================================================================
// RefLoop — LinkedIn Jobs Floating Widget
// A Simplify-style floating tab + slide-in panel injected on LinkedIn job pages.
// Allows adding a job directly from the page without opening the extension popup.
//
// Behaviour:
//  • A ⚡ tab is pinned to the right edge of the viewport at all times
//  • Clicking it opens/closes a slide-in panel pre-filled with job details
//  • When ?currentJobId changes (SPA navigation) the panel auto-refreshes
//  • Submitting adds the job via chrome.runtime.sendMessage → background
// =============================================================================

import { readCurrentJobDetails } from './jobDetailsReader.js';

const WIDGET_ID = 'refloop-jobs-floating-widget';
const TAB_ID   = 'refloop-jobs-tab';
const PANEL_ID = 'refloop-jobs-panel';

// ─── state ──────────────────────────────────────────────────────────────────
let panelOpen  = false;
let lastJobId  = '';

// ─── public entry ────────────────────────────────────────────────────────────
export function initJobsFloatingWidget(): void {
  // Remove any old instance (SPA route change)
  destroyWidget();

  const url = new URL(window.location.href);
  const jobId = url.searchParams.get('currentJobId') ?? '';

  buildWidget(jobId);

  // If a job is already selected, load its details into the panel
  if (jobId) {
    lastJobId = jobId;
    void populatePanel(jobId);
  }
}

export function destroyWidget(): void {
  document.getElementById(WIDGET_ID)?.remove();
  panelOpen = false;
  lastJobId = '';
}

// ─── Inject scoped CSS reset ─────────────────────────────────────────────────
function injectStyles(): void {
  if (document.getElementById('refloop-widget-styles')) return;
  const style = document.createElement('style');
  style.id = 'refloop-widget-styles';
  style.textContent = `
    #${WIDGET_ID} * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      line-height: normal;
    }
    @keyframes refloop-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
}

// ─── DOM construction ────────────────────────────────────────────────────────
function buildWidget(initialJobId: string): void {
  if (document.getElementById(WIDGET_ID)) return;

  injectStyles();

  const root = document.createElement('div');
  root.id = WIDGET_ID;
  root.style.cssText = `
    position: fixed;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    pointer-events: none;
  `;

  // ── Floating tab button ─────────────────────────────────────────────────────
  const tab = document.createElement('button');
  tab.id = TAB_ID;
  tab.title = 'RefLoop — Add Job to Tracker';
  tab.style.cssText = `
    all: unset;
    width: 40px;
    height: 92px;
    background: linear-gradient(180deg, #E06D53 0%, #D97757 100%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-right: none;
    border-radius: 12px 0 0 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    transition: width 0.2s ease, background 0.2s ease, transform 0.2s ease;
    pointer-events: auto;
    flex-shrink: 0;
    box-sizing: border-box;
  `;
  tab.innerHTML = `
    <div style="
      width: 24px;
      height: 24px;
      background: rgba(255, 255, 255, 0.22);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      line-height: 1;
    ">⚡</div>
    <span style="
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      font-size: 10px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 1.5px;
      display: block;
      line-height: 1;
      text-transform: uppercase;
      margin-bottom: 2px;
    ">REFLOOP</span>
  `;

  tab.addEventListener('mouseenter', () => {
    tab.style.background = 'linear-gradient(180deg, #C86545 0%, #BF6640 100%)';
    tab.style.width = '44px';
  });
  tab.addEventListener('mouseleave', () => {
    tab.style.background = 'linear-gradient(180deg, #E06D53 0%, #D97757 100%)';
    tab.style.width = '40px';
  });
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel();
  });

  root.appendChild(tab);

  // ── Slide-in panel ──────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = `
    width: 310px;
    background: #18181B;
    border: 1px solid #3F3F46;
    border-right: none;
    border-radius: 16px 0 0 16px;
    box-shadow: -12px 0 36px rgba(0,0,0,0.5);
    padding: 20px;
    transform: translateX(100%);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease, visibility 0.3s;
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
  `;

  panel.innerHTML = buildPanelHTML();
  root.appendChild(panel);

  document.body.appendChild(root);

  // Wire up internal panel events
  wirePanelEvents(panel);

  // If a job is already selected, open panel automatically after a short delay
  if (initialJobId) {
    setTimeout(() => openPanel(), 800);
  }
}

// ─── Panel HTML template ─────────────────────────────────────────────────────
function buildPanelHTML(details?: { jobTitle: string; companyName: string; jobLink: string }): string {
  const company = details?.companyName ?? '';
  const title   = details?.jobTitle ?? '';
  const link    = details?.jobLink ?? '';
  const loading = !details;

  if (loading) {
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="
          width:30px;height:30px;min-width:30px;
          background:linear-gradient(135deg,#E06D53,#D97757);
          border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          font-size:15px;line-height:1;
        ">⚡</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#F4F4F5;line-height:1.3;">RefLoop</div>
          <div style="font-size:9px;font-weight:600;color:#D97757;letter-spacing:0.8px;line-height:1.3;">REFERRAL TRACKER</div>
        </div>
      </div>
      <div style="height:1px;background:#3F3F46;margin-bottom:16px;"></div>
      <div style="text-align:center;padding:24px 0;color:#71717A;font-size:12px;">
        <div style="font-size:22px;margin-bottom:10px;animation:refloop-pulse 1.2s ease-in-out infinite;">⚡</div>
        Reading job details…
      </div>
    `;
  }

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <div style="
          width:30px;height:30px;min-width:30px;
          background:linear-gradient(135deg,#E06D53,#D97757);
          border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          font-size:15px;line-height:1;
        ">⚡</div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#F4F4F5;line-height:1.3;">RefLoop</div>
          <div style="font-size:9px;font-weight:600;color:#D97757;letter-spacing:0.8px;line-height:1.3;">REFERRAL TRACKER</div>
        </div>
      </div>
      <button id="refloop-panel-close" style="
        all:unset;cursor:pointer;
        width:24px;height:24px;min-width:24px;
        display:flex;align-items:center;justify-content:center;
        color:#71717A;font-size:14px;line-height:1;
        border-radius:6px;
        transition:background 0.15s, color 0.15s;
      " title="Close">✕</button>
    </div>

    <div style="height:1px;background:#3F3F46;margin-bottom:16px;"></div>

    <div id="refloop-panel-form">
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:10px;font-weight:700;color:#A1A1AA;margin-bottom:6px;letter-spacing:0.8px;text-transform:uppercase;">Company</label>
        <input id="refloop-widget-company"
          type="text"
          value="${escapeHtml(company)}"
          placeholder="e.g. Visa, Google"
          style="
            width:100%;box-sizing:border-box;
            padding:10px 12px;
            background:#27272A;border:1px solid #3F3F46;
            border-radius:10px;font-size:13px;color:#F4F4F5;
            font-family:inherit;outline:none;
            transition:border-color 0.15s;
          "
        />
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:10px;font-weight:700;color:#A1A1AA;margin-bottom:6px;letter-spacing:0.8px;text-transform:uppercase;">Job Title</label>
        <input id="refloop-widget-title"
          type="text"
          value="${escapeHtml(title)}"
          placeholder="e.g. Sr. Software Engineer"
          style="
            width:100%;box-sizing:border-box;
            padding:10px 12px;
            background:#27272A;border:1px solid #3F3F46;
            border-radius:10px;font-size:13px;color:#F4F4F5;
            font-family:inherit;outline:none;
            transition:border-color 0.15s;
          "
        />
      </div>

      <input id="refloop-widget-link" type="hidden" value="${escapeHtml(link)}" />

      <button id="refloop-widget-submit" style="
        all:unset;
        display:flex;align-items:center;justify-content:center;gap:6px;
        width:100%;box-sizing:border-box;
        padding:11px 16px;
        background:linear-gradient(135deg,#E06D53,#D97757);
        color:white;border-radius:10px;
        font-size:13px;font-weight:700;cursor:pointer;
        box-shadow:0 4px 14px rgba(217,119,87,0.35);
        transition:opacity 0.15s,transform 0.1s;
        font-family:inherit;
        text-align:center;
      ">
        <span style="font-size:15px;line-height:1;">+</span>
        <span>Add Job to RefLoop</span>
      </button>

      <div id="refloop-widget-error" style="
        display:none;margin-top:10px;
        font-size:11px;color:#F87171;text-align:center;
      "></div>
    </div>
  `;
}

function buildSuccessHTML(company: string, title: string): string {
  return `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:36px;margin-bottom:10px;line-height:1;">✅</div>
      <div style="font-size:14px;font-weight:700;color:#34D399;margin-bottom:6px;line-height:1.3;">Added to RefLoop!</div>
      <div style="font-size:11px;color:#A1A1AA;margin-bottom:16px;line-height:1.4;word-break:break-word;">${escapeHtml(title)} at ${escapeHtml(company)}</div>
      <button id="refloop-widget-open-dash" style="
        all:unset;
        display:inline-flex;align-items:center;justify-content:center;gap:4px;
        padding:9px 18px;
        background:#27272A;border:1px solid #3F3F46;
        color:#F4F4F5;border-radius:10px;font-size:12px;font-weight:600;
        cursor:pointer;font-family:inherit;
        transition:background 0.15s;
      ">Open Dashboard <span style="font-size:14px;">↗</span></button>
    </div>
  `;
}

// ─── Panel open/close ─────────────────────────────────────────────────────────
function openPanel(): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.style.transform = 'translateX(0)';
  panel.style.opacity = '1';
  panel.style.visibility = 'visible';
  panel.style.pointerEvents = 'auto';
  panelOpen = true;
}

function closePanel(): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.style.transform = 'translateX(100%)';
  panel.style.opacity = '0';
  panel.style.visibility = 'hidden';
  panel.style.pointerEvents = 'none';
  panelOpen = false;
}

function togglePanel(): void {
  panelOpen ? closePanel() : openPanel();
}

// ─── Populate panel with live job details ─────────────────────────────────────
async function populatePanel(jobId: string): Promise<void> {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  // Show loading state
  panel.innerHTML = buildPanelHTML();
  wirePanelEvents(panel);

  const details = await readCurrentJobDetails();

  if (!panel.isConnected) return; // widget was removed during await

  if (details) {
    panel.innerHTML = buildPanelHTML(details);
  } else {
    // No details found — show empty form
    panel.innerHTML = buildPanelHTML({
      jobTitle: '',
      companyName: '',
      jobLink: `${window.location.origin}/jobs/view/${jobId}/`,
    });
  }
  wirePanelEvents(panel);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
function wirePanelEvents(panel: HTMLElement): void {
  // Close button
  const closeBtn = panel.querySelector('#refloop-panel-close') as HTMLElement | null;
  closeBtn?.addEventListener('click', () => closePanel());
  closeBtn?.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#27272A';
    closeBtn.style.color = '#F4F4F5';
  });
  closeBtn?.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#71717A';
  });

  // Focus highlight for inputs
  panel.querySelectorAll('input[type="text"]').forEach((input) => {
    input.addEventListener('focus', () => {
      (input as HTMLElement).style.borderColor = '#D97757';
    });
    input.addEventListener('blur', () => {
      (input as HTMLElement).style.borderColor = '#3F3F46';
    });
  });

  // Submit button
  const submitBtn = panel.querySelector('#refloop-widget-submit') as HTMLButtonElement | null;
  submitBtn?.addEventListener('click', () => void handleSubmit(panel));

  // Hover effects on submit
  submitBtn?.addEventListener('mouseenter', () => {
    if (submitBtn) {
      submitBtn.style.opacity = '0.9';
      submitBtn.style.transform = 'translateY(-1px)';
    }
  });
  submitBtn?.addEventListener('mouseleave', () => {
    if (submitBtn) {
      submitBtn.style.opacity = '1';
      submitBtn.style.transform = 'translateY(0)';
    }
  });

  // Open Dashboard button
  panel.querySelector('#refloop-widget-open-dash')?.addEventListener('click', () => {
    void chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });
}

async function handleSubmit(panel: HTMLElement): Promise<void> {
  const companyInput = panel.querySelector('#refloop-widget-company') as HTMLInputElement | null;
  const titleInput   = panel.querySelector('#refloop-widget-title')   as HTMLInputElement | null;
  const linkInput    = panel.querySelector('#refloop-widget-link')    as HTMLInputElement | null;
  const errorDiv     = panel.querySelector('#refloop-widget-error')   as HTMLElement | null;
  const submitBtn    = panel.querySelector('#refloop-widget-submit')  as HTMLButtonElement | null;

  const companyName = companyInput?.value.trim() ?? '';
  const jobTitle    = titleInput?.value.trim()   ?? '';
  const jobLink     = linkInput?.value           ?? window.location.href.split('?')[0]!;

  if (!companyName || !jobTitle) {
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'Please fill in both Company and Job Title.';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.style.opacity = '0.6';
    submitBtn.style.pointerEvents = 'none';
    submitBtn.innerHTML = '<span style="opacity:0.8;">Adding…</span>';
  }

  if (!chrome.runtime?.id) {
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'Extension context lost — please refresh the page.';
    }
    if (submitBtn) {
      submitBtn.style.opacity = '1';
      submitBtn.style.pointerEvents = 'auto';
      submitBtn.innerHTML = '<span style="font-size:15px;line-height:1;">+</span><span>Add Job to RefLoop</span>';
    }
    return;
  }

  try {
    const isEasyApply = !!document.querySelector('button[aria-label*="Easy Apply" i]');

    await new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'ADD_JOB_REQUEST',
          payload: {
            companyName,
            jobTitle,
            jobLink,
            sourceType: isEasyApply ? 'EASY_APPLY' : 'COMPANY_SITE',
          },
        },
        (res: { success?: boolean; error?: string } | undefined) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          if (res?.success) resolve();
          else reject(new Error(res?.error ?? 'Unknown error'));
        },
      );
    });

    // Replace form with success
    const formEl = panel.querySelector('#refloop-panel-form') as HTMLElement | null;
    if (formEl) {
      formEl.innerHTML = buildSuccessHTML(companyName, jobTitle);
      wirePanelEvents(panel);
    }

  } catch (err) {
    console.error('[RefLoop] Widget submit error:', err);
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Error: ${String(err)}`;
    }
    if (submitBtn) {
      submitBtn.style.opacity = '1';
      submitBtn.style.pointerEvents = 'auto';
      submitBtn.innerHTML = '<span style="font-size:15px;line-height:1;">+</span><span>Add Job to RefLoop</span>';
    }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── SPA job-change watcher ───────────────────────────────────────────────────
// Called by index.ts MutationObserver when the URL changes.
// Re-populates the panel whenever currentJobId changes without re-building the widget.
export function onJobIdChange(newJobId: string): void {
  if (newJobId === lastJobId) return;
  lastJobId = newJobId;

  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  if (!newJobId) {
    // No job selected — reset to loading
    panel.innerHTML = buildPanelHTML();
    wirePanelEvents(panel);
    return;
  }

  void populatePanel(newJobId);
}
