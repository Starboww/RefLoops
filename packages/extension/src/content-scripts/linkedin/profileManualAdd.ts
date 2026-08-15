import { PROFILE_NAME_SELECTORS, queryFirst } from './selectors.js';

export function initProfileManualAdd() {
  setTimeout(injectProfileButton, 1000);
}

function injectProfileButton() {
  if (document.getElementById('refloop-profile-add-btn')) return;

  const nameEl = queryFirst(PROFILE_NAME_SELECTORS);
  if (!nameEl) return;

  const button = document.createElement('button');
  button.id = 'refloop-profile-add-btn';
  button.innerText = '⚡ Add Contact to RefLoop';
  button.style.cssText = `
    margin-left: 12px;
    padding: 4px 10px;
    background-color: #4F46E5;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    z-index: 9999;
  `;

  button.addEventListener('click', () => {
    void chrome.runtime.sendMessage({
      type: 'OPEN_DASHBOARD',
    });
  });

  nameEl.appendChild(button);
}
