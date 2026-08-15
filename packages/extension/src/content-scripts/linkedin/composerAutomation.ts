// =============================================================================
// RefLoop — LinkedIn Composer Automation (Content Script)
// PRD §11.1: "fill [composer] with the assembled message, and click LinkedIn's
// own Send button."
// Technical Design §11.2: simulated typing + click, retry logic.
// =============================================================================

import type { PasteAndSendMessage } from '@refloop/core';
import {
  COMPOSER_TEXTAREA_SELECTORS,
  COMPOSER_SEND_BUTTON_SELECTORS,
  queryFirst,
} from './selectors.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

/**
 * Listen for PASTE_AND_SEND commands from the background service worker.
 * Opens the message composer, fills it with the assembled message, and sends.
 * PRD §11.2: simulated typing using InputEvent (not .value assignment)
 * for React synthetic event compatibility.
 */
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: string }).type === 'PASTE_AND_SEND'
  ) {
    const msg = message as PasteAndSendMessage;
    void executeWithRetry(msg.payload.message, MAX_RETRIES)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true; // async response
  }

  // Handle FETCH_CONNECTIONS_REQUEST — returns current 1st-degree connections
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: string }).type === 'FETCH_CONNECTIONS_REQUEST'
  ) {
    void fetchConnections().then((connections) => sendResponse({ connections }));
    return true;
  }

  return false;
});

async function executeWithRetry(
  messageText: string,
  retriesLeft: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find the message composer — may need to wait for LinkedIn's UI to mount
    const textarea = queryFirst(COMPOSER_TEXTAREA_SELECTORS) as HTMLElement | null;

    if (!textarea) {
      if (retriesLeft > 0) {
        await delay(RETRY_DELAY_MS);
        return executeWithRetry(messageText, retriesLeft - 1);
      }
      return { success: false, error: 'Message composer not found after retries' };
    }

    // Focus the textarea
    textarea.focus();

    // Clear existing content
    await selectAll(textarea);

    // Simulate typing using InputEvent (React-compatible — PRD §11.2)
    await pasteText(textarea, messageText);

    // Brief pause for React to process the input event
    await delay(200);

    // Find and click the Send button
    const sendBtn = queryFirst(COMPOSER_SEND_BUTTON_SELECTORS) as HTMLElement | null;
    if (!sendBtn) {
      return { success: false, error: 'Send button not found' };
    }

    sendBtn.click();
    await delay(500); // wait for send animation

    return { success: true };
  } catch (err) {
    if (retriesLeft > 0) {
      await delay(RETRY_DELAY_MS);
      return executeWithRetry(messageText, retriesLeft - 1);
    }
    return { success: false, error: String(err) };
  }
}

/** Simulate Ctrl+A to select all text in a contenteditable element */
async function selectAll(element: HTMLElement): Promise<void> {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
  await delay(50);
  // Also use document.execCommand for broader compatibility
  document.execCommand('selectAll', false);
  await delay(50);
}

/**
 * Insert text using InputEvent — React's synthetic event system picks this up.
 * Do NOT use element.value = text or element.innerHTML = text directly,
 * as React won't detect those changes.
 */
async function pasteText(element: HTMLElement, text: string): Promise<void> {
  // Use execCommand for contenteditable divs
  if (element.contentEditable === 'true') {
    // Select all and replace
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(element);
      selection.collapseToEnd();
    }
    element.innerHTML = '';

    // Insert via nativeInputValueSetter trick for React-owned inputs
    const insertEvent = new InputEvent('input', {
      data: text,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    });
    document.execCommand('insertText', false, text);
    element.dispatchEvent(insertEvent);
  } else {
    // Regular textarea/input fallback
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, text);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await delay(100);
}

/**
 * Attempt to fetch LinkedIn 1st-degree connection profile URLs.
 * PRD §11.3: "fetch your 1st-degree connections list once per session"
 * This is read-only and safe to automate.
 */
async function fetchConnections(): Promise<string[]> {
  try {
    // LinkedIn's connections page — parse profile links from existing DOM
    if (window.location.href.includes('/mynetwork/invite-connect/connections')) {
      const profileLinks = Array.from(
        document.querySelectorAll('a[href*="/in/"]'),
      ) as HTMLAnchorElement[];
      return profileLinks
        .map((a) => a.href)
        .filter((href) => href.includes('/in/'))
        .map((href) => normalizeProfileUrl(href));
    }

    // On other LinkedIn pages — return empty (background will try again on connections page)
    return [];
  } catch {
    return [];
  }
}

function normalizeProfileUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return url;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
