// =============================================================================
// RefLoop — Manifest V3 Configuration
// All extension metadata, permissions, and entry points defined here.
// =============================================================================
import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';
export default defineManifest({
    manifest_version: 3,
    name: 'RefLoop — LinkedIn Referral Tracker',
    description: 'Track your LinkedIn referral outreach pipeline. Log jobs, manage contacts across LinkedIn and Email, and never let a warm connection go cold.',
    version: packageJson.version,
    version_name: `${packageJson.version} (beta)`,
    // ---------------------------------------------------------------------------
    // Icons
    // ---------------------------------------------------------------------------
    icons: {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
    },
    // ---------------------------------------------------------------------------
    // Permissions — PRD §11.6
    // ---------------------------------------------------------------------------
    permissions: [
        'storage', // chrome.storage.local — all data
        'alarms', // chrome.alarms — housekeeping timer
        'scripting', // inject content scripts dynamically
        'identity', // Google Sign-In via chrome.identity
        'notifications', // follow-up ready notifications (PRD §8.7)
        'downloads', // Export data backup (Technical Design §2.3)
        'tabs', // open LinkedIn profile tab on Send
        'activeTab', // read current tab URL in popup
        'clipboardWrite', // Email clipboard fallback (PRD §11.1)
    ],
    // ---------------------------------------------------------------------------
    // Host permissions — LinkedIn + 7 ATS platforms (PRD §8.1, §11.6)
    // ---------------------------------------------------------------------------
    host_permissions: [
        '*://*.linkedin.com/*',
        '*://boards.greenhouse.io/*',
        '*://jobs.lever.co/*',
        '*://*.myworkdayjobs.com/*',
        '*://jobs.smartrecruiters.com/*',
        '*://*.icims.com/*',
        '*://jobs.ashbyhq.com/*',
        '*://*.taleo.net/*',
    ],
    // ---------------------------------------------------------------------------
    // Background Service Worker — MV3 required (Technical Design §2.1)
    // ---------------------------------------------------------------------------
    background: {
        service_worker: 'src/background/index.ts',
        type: 'module',
    },
    // ---------------------------------------------------------------------------
    // Content Scripts
    // ---------------------------------------------------------------------------
    content_scripts: [
        // LinkedIn — Add to Tracker + Connect listener + composer automation
        {
            matches: ['*://*.linkedin.com/*'],
            js: ['src/content-scripts/linkedin/index.ts'],
            run_at: 'document_idle',
        },
        // Greenhouse
        {
            matches: ['*://boards.greenhouse.io/*/jobs/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
        // Lever
        {
            matches: ['*://jobs.lever.co/*/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
        // Workday
        {
            matches: ['*://*.myworkdayjobs.com/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
        // SmartRecruiters
        {
            matches: ['*://jobs.smartrecruiters.com/*/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
        // iCIMS
        {
            matches: ['*://*.icims.com/jobs/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
        // Ashby
        {
            matches: ['*://jobs.ashbyhq.com/*/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
        // Taleo
        {
            matches: ['*://*.taleo.net/careersection/*'],
            js: ['src/content-scripts/ats/index.ts'],
            run_at: 'document_idle',
        },
    ],
    // ---------------------------------------------------------------------------
    // Toolbar Popup — quick add + status
    // ---------------------------------------------------------------------------
    action: {
        default_popup: 'src/popup/index.html',
        default_title: 'RefLoop',
        default_icon: {
            '16': 'icons/icon16.png',
            '32': 'icons/icon32.png',
        },
    },
    // ---------------------------------------------------------------------------
    // Full-screen Dashboard
    // ---------------------------------------------------------------------------
    options_page: 'src/dashboard/index.html',
    // ---------------------------------------------------------------------------
    // OAuth2 for Google Sign-In — chrome.identity
    // IMPORTANT: Replace 'YOUR_OAUTH_CLIENT_ID' with your actual Google OAuth
    // client ID from Google Cloud Console before distributing.
    // See README.md for setup instructions.
    // ---------------------------------------------------------------------------
    oauth2: {
        client_id: 'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com',
        scopes: ['openid', 'email', 'profile'],
    },
    // ---------------------------------------------------------------------------
    // Content Security Policy (MV3)
    // ---------------------------------------------------------------------------
    content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'",
    },
    oauth2: {
        client_id: '305413154035-5ubnjcci14qpng8tm44r93s7bpqmncv5.apps.googleusercontent.com',
        scopes: ['openid', 'email', 'profile'],
    },

});
