// =============================================================================
// RefLoop — LinkedIn Composer Automation (Content Script)
// PRD §11.1: "fill [composer] with the assembled message, and click LinkedIn's
// own Send button."
// Technical Design §11.2: simulated typing + click, retry logic.
//
// IMPORTANT: This file is imported by index.ts which is re-injected on every
// SPA navigation. We MUST guard against double-registering the message listener,
// otherwise the same OPEN_COMPOSER_AND_SEND message fires the handler multiple
// times, clicking the Message button multiple times and opening multiple dialogs.
// =============================================================================

import type { PasteAndSendMessage, OpenComposerAndSendMessage } from '@refloop/core';
import {
  COMPOSER_TEXTAREA_SELECTORS,
  COMPOSER_SEND_BUTTON_SELECTORS,
  MESSAGE_BUTTON_SELECTORS,
  queryFirst,
} from './selectors.js';

// ---------------------------------------------------------------------------
// Idempotency guard — only register the listener ONCE per page context.
// Without this, re-injections on SPA nav would stack up multiple listeners,
// causing the Message button to be clicked multiple times per trigger.
// ---------------------------------------------------------------------------
interface RefLoopWindowState {
  __refloop_composer_listener__?: boolean;
}
const _win = window as unknown as RefLoopWindowState;
if (_win.__refloop_composer_listener__) {
  // Listener already registered in this page context — skip re-registration.
} else {
  _win.__refloop_composer_listener__ = true;

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) return false;
    const msg = message as { type?: string; payload?: unknown };

    // PASTE_AND_SEND — composer is already open, just fill it
    if (msg.type === 'PASTE_AND_SEND') {
      const { message: text } = (msg as PasteAndSendMessage).payload;
      void fillAndSend(text)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }

    // OPEN_COMPOSER_AND_SEND — click Message button first, then fill
    if (msg.type === 'OPEN_COMPOSER_AND_SEND') {
      const { message: text } = (msg as OpenComposerAndSendMessage).payload;
      void openComposerAndSend(text)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }

    // FETCH_CONNECTIONS_REQUEST
    if (msg.type === 'FETCH_CONNECTIONS_REQUEST') {
      void fetchConnections().then((connections) => sendResponse({ connections }));
      return true;
    }

    return false;
  });
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Click LinkedIn's "Message" button on a profile page (once),
 * wait for the compose textarea to appear, then fill and send.
 */
async function openComposerAndSend(
  messageText: string,
): Promise<{ success: boolean; error?: string }> {
  // If a composer textarea is already visible on the page, skip clicking the button.
  let textarea = queryFirst(COMPOSER_TEXTAREA_SELECTORS) as HTMLElement | null;

  if (!textarea) {
    // Find the "Message" button — this is often an <a> tag on LinkedIn.
    const messageBtn = queryFirst(MESSAGE_BUTTON_SELECTORS) as HTMLElement | null;
    if (!messageBtn) {
      return {
        success: false,
        error: 'Message button not found — is this a 1st-degree connection?',
      };
    }

    // IMPORTANT: LinkedIn's Message button is an <a> tag with an href that
    // points to /messaging/compose/... If we call .click() directly, the
    // browser follows the href AND triggers LinkedIn's event handler, opening
    // BOTH a new messaging page AND an overlay dialog = multiple windows.
    //
    // Fix: dispatch a MouseEvent that triggers LinkedIn's JS handler,
    // then immediately prevent the default link navigation.
    messageBtn.addEventListener('click', (e) => e.preventDefault(), { once: true });
    messageBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Poll for composer textarea to appear (up to 8s)
    const found = await pollForElement(COMPOSER_TEXTAREA_SELECTORS, 8_000, 200);
    if (!found) {
      return {
        success: false,
        error: 'Composer did not open after clicking Message button (timeout 8s).',
      };
    }
    textarea = found as HTMLElement;
  }

  // LinkedIn injects a default greeting draft after the composer opens —
  // give it time to finish so our clear operation removes it completely.
  await delay(800);

  return fillAndSend(messageText, textarea);
}

/**
 * Given an already-open composer textarea: clear all existing text, paste the
 * new message, and click Send.
 *
 * Approach (exactly as the user described):
 *   1. Focus
 *   2. Ctrl+A  (select all)
 *   3. Backspace / Delete  (clear)
 *   4. insertText  (paste)
 */
async function fillAndSend(
  messageText: string,
  textareaEl?: HTMLElement,
): Promise<{ success: boolean; error?: string }> {
  const textarea = textareaEl ?? (queryFirst(COMPOSER_TEXTAREA_SELECTORS) as HTMLElement | null);
  if (!textarea) {
    return { success: false, error: 'Composer textarea not found.' };
  }

  // 1. Focus
  textarea.focus();
  await delay(100);

  // 2. Select ALL existing content (Ctrl+A)
  document.execCommand('selectAll', false);
  await delay(80);

  // 3. Delete selected content (Backspace)
  document.execCommand('delete', false);
  // Dispatch React-compatible input event for the deletion
  textarea.dispatchEvent(
    new InputEvent('input', {
      inputType: 'deleteContentBackward',
      bubbles: true,
      cancelable: true,
    }),
  );
  await delay(80);

  // 4. Insert our message text
  document.execCommand('insertText', false, messageText);
  textarea.dispatchEvent(
    new InputEvent('input', {
      data: messageText,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    }),
  );
  await delay(300);

  // 5. Click Send
  const sendBtn = queryFirst(COMPOSER_SEND_BUTTON_SELECTORS) as HTMLElement | null;
  if (!sendBtn) {
    return { success: false, error: 'Send button not found.' };
  }
  sendBtn.click();
  await delay(500);

  return { success: true };
}

/**
 * Poll the DOM for one of the given selectors until it resolves or times out.
 */
function pollForElement(
  selectors: string[],
  timeoutMs: number,
  intervalMs: number,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = queryFirst(selectors);
      if (el) {
        clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, intervalMs);
  });
}

// ---------------------------------------------------------------------------
// Connections fetcher (unchanged)
// ---------------------------------------------------------------------------

async function fetchConnections(): Promise<string[]> {
  try {
    if (window.location.href.includes('/mynetwork/invite-connect/connections')) {
      const profileLinks = Array.from(
        document.querySelectorAll('a[href*="/in/"]'),
      ) as HTMLAnchorElement[];
      return profileLinks
        .map((a) => a.href)
        .filter((href) => href.includes('/in/'))
        .map((href) => normalizeProfileUrl(href));
    }
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
