# RefLoop — LinkedIn Referral Outreach Tracker
## Master Build Checklist

> **Strategy:** Items are ordered so each layer is complete before the next one depends on it.
> Mark `[x]` when done, `[/]` when in progress.
> Architecture: **Extension-only (Option A)** · pnpm monorepo · TypeScript · React 18 · Tailwind CSS · Radix UI · Zustand · chrome.storage.local

---

## Phase 0 — Project Scaffold & Tooling

### 0.1 Monorepo Bootstrap
- [ ] Initialize pnpm workspace root with `pnpm-workspace.yaml` listing all packages
- [ ] Create root `package.json` with workspace-level dev dependencies (TypeScript, ESLint, Prettier, Vitest, Playwright, husky, lint-staged)
- [ ] Create `tsconfig.base.json` with `strict: true`, `paths` for package aliases
- [ ] Configure ESLint (`typescript-eslint`) + Prettier with `.eslintrc.cjs` and `.prettierrc`
- [ ] Configure husky pre-commit hook running lint-staged (ESLint + Prettier + type-check)
- [ ] Create root `.gitignore` covering `node_modules/`, `dist/`, `.crx/`, `*.pem`

### 0.2 Package Skeleton — `packages/core`
- [ ] Create `packages/core/package.json` (no browser deps, `"main"` points to compiled output)
- [ ] Create `packages/core/tsconfig.json` extending `tsconfig.base.json`
- [ ] Create directory skeleton: `src/domain/`, `src/services/`, `src/clock/`, `src/index.ts`
- [ ] Configure Vitest for `packages/core`

### 0.3 Package Skeleton — `packages/storage-chrome`
- [ ] Create `packages/storage-chrome/package.json` (peer-dep on `packages/core`)
- [ ] Create `packages/storage-chrome/tsconfig.json`
- [ ] Create directory skeleton: `src/migrations/`, `src/index.ts`

### 0.4 Package Skeleton — `packages/ui`
- [ ] Create `packages/ui/package.json` (peer-deps: React, Radix, Tailwind)
- [ ] Create `packages/ui/tsconfig.json`
- [ ] Create `packages/ui/tailwind.config.ts`
- [ ] Create directory skeleton: `src/tokens/`, `src/components/`, `src/hooks/`, `src/index.ts`

### 0.5 Package Skeleton — `packages/extension`
- [ ] Create `packages/extension/package.json`
- [ ] Create `packages/extension/vite.config.ts` with `@crxjs/vite-plugin`
- [ ] Create `packages/extension/manifest.config.ts` for MV3 manifest source
- [ ] Create all subdirectory skeletons under `src/`

### 0.6 Chrome Extension Manifest (MV3)
- [ ] Set `manifest_version: 3`
- [ ] Declare permissions: `storage`, `alarms`, `scripting`, `identity`, `notifications`, `downloads`, `tabs`
- [ ] Declare host permissions for LinkedIn + all 7 ATS platforms
- [ ] Register background service worker, content scripts, popup, dashboard
- [ ] Set OAuth2 config for Google identity

---

## Phase 1 — Domain Layer (`packages/core`)

### 1.1 Data Models (`src/domain/models.ts`)
- [ ] `JobPosting` interface — ALL fields: id, jobLink, sourceType (EASY_APPLY|COMPANY_SITE), companyName, companyLinkedInSlug?, jobTitle, companyJobId?, companyApplyUrl?, dateAdded (ISO 8601), status (ACTIVE|ARCHIVED|CLOSED|REFERRAL_RECEIVED), archiveReason?, referralReceivedAt?, referralMessageTemplate, emailMessageTemplate?, emailSubjectTemplate?, followUp1TemplateOverride?, followUp2TemplateOverride?
- [ ] `ContactChannel` type: `'LINKEDIN' | 'EMAIL'`
- [ ] `Contact` interface — ALL fields:
  - Shared: id, jobPostingId, channel, firstName
  - LinkedIn-only: linkedinProfileUrl?, fullNameRaw?, connectionRequestSentAt?, connectionStatus (PENDING|ACCEPTED|EXPIRED|DECLINED_OR_REMOVED)?
  - Email-only: emailAddress?, emailSource (GENERATED|MANUAL)?, emailAddedAt?
  - Shared status fields: outreachMessageStatus (QUEUED|READY_TO_SEND|SENT|EXPIRED|CANCELLED_BY_USER), outreachMessageSentAt?
  - followUp1Status (NOT_SCHEDULED|SCHEDULED|READY_TO_SEND|SENT|SKIPPED|CANCELLED_BY_USER), followUp1ScheduledFor?, followUp1SentAt?
  - followUp2Status (same union), followUp2ScheduledFor?, followUp2SentAt?
  - removedAt?
- [ ] `GlobalSettings` interface — ALL fields with defaults: contactExpiryDays (14), followUp1DelayDays (5), followUp2DelayDays (7), sendWindowStart ("09:00"), sendWindowEnd ("10:00"), activeDays ([1,2,3,4,5]), greetingFormat, followUp1Template, followUp2Template, dailySendCap (15, soft warning only), interMessageDelaySeconds ([30,180])
- [ ] `UserAccount` interface: googleId, email, displayName?, signedInAt
- [ ] `Stage` type: `'OUTREACH' | 'FU1' | 'FU2'`
- [ ] `DEFAULT_SETTINGS` constant

### 1.2 Repository Interfaces (`src/domain/repositories.ts`)
- [ ] `Unsubscribe` type
- [ ] `JobRepository`: getAll, getById, create, update, delete, onChange
- [ ] `ContactRepository`: getAll, getByJobId, create, update, onChange
- [ ] `SettingsRepository`: get, update
- [ ] `UserAccountRepository`: get, set, clear

### 1.3 Clock Interface (`src/clock/Clock.ts`)
- [ ] `Clock` interface + `SystemClock` implementation

### 1.4 Typed Message Union (`src/messages/messages.ts`)
- [ ] `ExtensionMessage` discriminated union: CONTACT_ADD_REQUEST, SEND_MESSAGE_REQUEST, PASTE_AND_SEND, SEND_CONFIRMED, SEND_FAILED, HOUSEKEEPING_RUN, CONTACT_UPDATED, JOB_UPDATED, OPEN_DASHBOARD, ADD_JOB_REQUEST, SIGN_IN_REQUEST, SIGN_OUT_REQUEST
- [ ] `NewContactInput` and `NewJobInput` input types

### 1.5 Services

#### 1.5.1 SchedulingService
- [ ] `nextValidWindow(date, settings): Date` — rolls to next valid day+window (weekend → Monday 9am, off-hours → next window start)
- [ ] Unit tests: all edge cases (Sat→Mon, Fri 11pm→Mon 9am, Mon 9:30am stays, Mon 8am→9am)

#### 1.5.2 MessageAssemblyService
- [ ] `assembleOutreach(job, contact, settings)` — LinkedIn: greeting + blank line + referralMessageTemplate; Email: subject from emailSubjectTemplate, same body pattern with emailMessageTemplate; {{firstName}} substituted
- [ ] `resolveFollowUpTemplate(job, settings, stage)` — job override wins, else global default (Strategy pattern)
- [ ] `assembleFollowUp(job, contact, settings, stage)` — same greeting + resolved template
- [ ] Unit tests: substitution, override resolution, LinkedIn vs Email differences

#### 1.5.3 HousekeepingService
- [ ] `run(acceptedLinkedInProfiles: Set<string>)` implementing PRD §12 algorithm:
  - LinkedIn PENDING expiry: now - connectionRequestSentAt > contactExpiryDays → EXPIRED, removedAt set
  - LinkedIn acceptance: profile in acceptedSet AND status PENDING → ACCEPTED, outreachMessageStatus READY_TO_SEND
  - Email expiry safety net: channel EMAIL AND outreachStatus SENT AND now - outreachSentAt > expiryDays AND followUp2 resolved → removedAt set
  - FU1 readiness: followUp1Status SCHEDULED AND now >= followUp1ScheduledFor → READY_TO_SEND + notify
  - FU2 readiness: followUp2Status SCHEDULED AND now >= followUp2ScheduledFor → READY_TO_SEND + notify
  - Auto-archive: ACTIVE job where ALL contacts have removedAt set → ARCHIVED + archiveReason AUTO_NO_ACTIVE_CONTACTS (excludes REFERRAL_RECEIVED jobs)
  - Daily cap: countSentToday() >= dailySendCap → emit soft warning (never block)
- [ ] `countSentToday(contacts)` — all stages sent since midnight
- [ ] Unit tests: expiry exact boundary (14 days vs 13), acceptance detection, FU transitions, auto-archive trigger (all removed vs one active), no-contacts guard, REFERRAL_RECEIVED exclusion

#### 1.5.4 EmailPatternService
- [ ] `NameParts` type, `RankedCandidate` type (email, tier, pattern)
- [ ] `normalize(name)`: lowercase, strip diacritics (Unicode NFD), strip apostrophes (O'Brien→obrien), hyphenated names → both joined (smithjones) and first-component (smith), drop suffixes (Jr./Sr./III/IV/II)
- [ ] `generateCandidates(nameParts, domain, confirmedPattern?)` — full tier logic:
  - Tier 1: first.last, f+last, first+l
  - Tier 2: first+last, first, f.last, first.l
  - Tier 3: last.first, l.first, last.f, last+first, l+first, last+f, f+l, last, first_last, first-last
  - Middle tier (if middle present): first.m.last, first+m+last, f+m+last
  - All de-duplicated
- [ ] `inferPatternFromConfirmed(confirmedEmail, domain)` — derive pattern from one known real email (§9.5 gold-standard)
- [ ] `applyInferredPattern(pattern, nameParts, domain)` — apply inferred pattern to new person
- [ ] Unit tests: normalization, tier correctness, middle name, dedup, confirmed pattern inference

#### 1.5.5 FuzzySearchService
- [ ] `searchCompanies(query, jobs)` — ACTIVE jobs only, fuzzy match on companyName, sorted by match quality
- [ ] `getRecentCompanies(jobs, count=3)` — top 3 ACTIVE by dateAdded, deduplicated by companyName
- [ ] Unit tests

### 1.6 Core Export (`src/index.ts`)
- [ ] Re-export all types, interfaces, services, Clock

---

## Phase 2 — Storage Adapter (`packages/storage-chrome`)

### 2.1 Change Bus (`src/changeBus.ts`)
- [ ] Typed wrapper around `chrome.storage.onChanged`
- [ ] `onKeyChanged(key, cb)` returning Unsubscribe

### 2.2 Schema Versioning & Migrations
- [ ] `runMigrations(currentVersion, targetVersion)` — runs ordered migration functions on load
- [ ] `schemaVersion` stored as separate key
- [ ] Migration `001-add-contact-channel.ts` — backfill `channel: 'LINKEDIN'` on existing contacts
- [ ] Migration `002-add-removed-at.ts` — backfill `removedAt` for contacts in terminal states

### 2.3 ChromeJobRepository
- [ ] Key: `jobs:v1`; implements create (UUID generation), update (patch merge), delete (filter), getAll, onChange

### 2.4 ChromeContactRepository
- [ ] Key: `contacts:v1`; implements getAll, getByJobId (filter), create, update, onChange

### 2.5 ChromeSettingsRepository
- [ ] Key: `settings:v1`; `get()` merges with DEFAULT_SETTINGS so new fields always have defaults; `update()` partial merge

### 2.6 ChromeUserAccountRepository
- [ ] Key: `userAccount:v1`; get, set, clear

### 2.7 Factory (`src/index.ts`)
- [ ] `createChromeRepositories()` — runs migrations on first call, returns all four repositories

---

## Phase 3 — UI Component Library (`packages/ui`)

### 3.1 Design Tokens
- [ ] `colors.css` — warm off-white bg, surface, raised surface, border variants, text/text-muted, accent (indigo oklch(0.55 0.18 264)), accent-fg, success/warning/danger/info with bg variants; dark mode via @media prefers-color-scheme
- [ ] `typography.css` — Inter Variable from Google Fonts as --font-sans, type scale xs(11px) to 2xl(24px), --font-mono for timestamps
- [ ] `radius.css` — sm(4px), md(8px), lg(12px), xl(16px)
- [ ] All tokens extended into Tailwind theme

### 3.2 Components (all built on Radix primitives + cva variants)
- [ ] **Button** — variants: primary, secondary, ghost, danger, link; sizes: sm, md, lg; loading/disabled states; Radix Slot asChild
- [ ] **Badge** — variants: default, success, warning, danger, info; channel badges (LinkedIn=blue, Email=purple)
- [ ] **StatusPill** — maps ALL Contact statuses (PENDING amber, ACCEPTED green, EXPIRED red, QUEUED gray, READY_TO_SEND blue, SENT green, CANCELLED gray, DECLINED_OR_REMOVED red) and Job statuses (ACTIVE blue, ARCHIVED gray, CLOSED red, REFERRAL_RECEIVED green)
- [ ] **Card** — surface container, border, padding, radius
- [ ] **Input** — text input with label, error state, helper text
- [ ] **Textarea** — multi-line version of Input
- [ ] **Select** — Radix Select, keyboard navigable
- [ ] **Combobox** — Radix-based searchable dropdown; supports fuzzy filtering; used for company picker (3 recent + search)
- [ ] **Dialog** — Radix Dialog; focus trap, Esc to close, backdrop
- [ ] **Tabs** — Radix Tabs; used for LinkedIn/Email split tabs
- [ ] **Toast** — Radix Toast; bottom-right, success/error/info variants
- [ ] **DataTable** — sortable, sticky header, column filters, expandable rows (for message preview), monospace timestamps, empty state slot
- [ ] **EmptyState** — icon + heading + subtext + optional CTA button
- [ ] **FormField** — label + input + error message wrapper
- [ ] **Spinner** — multiple sizes
- [ ] **ConfirmDialog** — reusable confirm/cancel modal wrapper

### 3.3 Hooks
- [ ] `useToast` — imperative API to fire toasts from anywhere

### 3.4 Export
- [ ] Re-export all components and hooks from `src/index.ts`

---

## Phase 4 — Background Service Worker

### 4.1 Message Router (`src/background/messageRouter.ts`)
- [ ] `chrome.runtime.onMessage.addListener` switching exhaustively on `message.type`
- [ ] Routes: ADD_JOB_REQUEST, CONTACT_ADD_REQUEST, SEND_MESSAGE_REQUEST, SIGN_IN_REQUEST, SIGN_OUT_REQUEST, HOUSEKEEPING_RUN
- [ ] Initialize repos and services on worker startup/install

### 4.2 Alarms (`src/background/alarms.ts`)
- [ ] Register `housekeeping` alarm with 5-minute period on startup
- [ ] `chrome.alarms.onAlarm` → trigger housekeeping run
- [ ] Re-register on `chrome.runtime.onInstalled` (service worker restart guard)

### 4.3 Housekeeping Runner (`src/background/housekeepingRunner.ts`)
- [ ] Fetch LinkedIn 1st-degree connections list (batch, read-only — §11.3)
- [ ] Build Set<string> of accepted profile URLs
- [ ] Run `HousekeepingService.run(acceptedProfiles)`
- [ ] Check daily cap → set badge/warning flag
- [ ] Fire `chrome.notifications` for contacts that transitioned to READY_TO_SEND this run
- [ ] Update badge count via `chrome.action.setBadgeText`
- [ ] Listen for LinkedIn tab focus events and trigger re-run

### 4.4 Send Action Runner (`src/background/sendActionRunner.ts`)
- [ ] `execute(contactId, stage)`:
  - Load contact + job + settings
  - Assemble message via `MessageAssemblyService`
  - **LinkedIn path**: `chrome.tabs.create({ url: profileUrl })`, wait for load, send `PASTE_AND_SEND` to content script, on `SEND_CONFIRMED` → update contact status, schedule next follow-up
  - **Email path**: encode mailto URL, `chrome.tabs.create({ url: mailtoUrl })`; if body too long (>1800 chars URL-encoded) → clipboard fallback + toast; immediately mark SENT, schedule next follow-up
  - After marking SENT: set followUpN status to SCHEDULED, set followUpNScheduledFor using SchedulingService.nextValidWindow()

### 4.5 Google Auth (`src/auth/googleAuth.ts`)
- [ ] `signIn()` — `chrome.identity.getAuthToken({ interactive: true })`, decode JWT payload, store UserAccount
- [ ] `signOut()` — `chrome.identity.removeCachedAuthToken()`, clear UserAccount from storage
- [ ] `getUser()` — read UserAccount from storage

### 4.6 Notifications (`src/background/notifications.ts`)
- [ ] `notifyFollowUpReady(contact, stage)` — `chrome.notifications.create()` with contact name + job + channel
- [ ] `updateBadge(count)` — `chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })`

---

## Phase 5 — Content Scripts

### 5.1 LinkedIn Selectors (`src/content-scripts/linkedin/selectors.ts`)
- [ ] Centralize ALL selectors; prefer aria-label > visible text > structural position > never obfuscated CSS classes
- [ ] Selectors needed: Connect button, message composer textarea, Send button in composer, profile name h1, profile URL, Easy Apply button, LinkedIn job title, company name, company LinkedIn slug
- [ ] Comment on each selector explaining the stable anchor used

### 5.2 LinkedIn Add-to-Tracker Injector
- [ ] On `linkedin.com/jobs/view/*`: detect EASY_APPLY vs COMPANY_SITE (Easy Apply button presence)
- [ ] Parse jobTitle (h1), companyName (company link text), companyLinkedInSlug (company URL), jobLink (current URL)
- [ ] Inject "Add to RefLoop" button next to Apply/Easy Apply button
- [ ] On click: open confirmation modal with parsed fields (all editable); submit saves job
- [ ] Show "Already tracked" badge if jobLink already in storage

### 5.3 LinkedIn Connect Button Listener
- [ ] Listen for click on LinkedIn's native Connect button (stable selector)
- [ ] On click: parse firstName (first whitespace token, strip credentials/emoji/pronouns), fullNameRaw, linkedinProfileUrl
- [ ] Duplicate check: query background for existing contact with this URL
- [ ] Open job-picker popup:
  - Quick-pick: 3 most-recent ACTIVE companies (FuzzySearchService.getRecentCompanies)
  - Fuzzy search field for other companies
  - Secondary job list if chosen company has >1 ACTIVE job
  - connectionRequestSentAt field (defaults now, editable)
  - Editable firstName field
- [ ] On confirm: save Contact (channel: LINKEDIN, connectionStatus: PENDING, outreachMessageStatus: QUEUED)

### 5.4 LinkedIn Composer Automation
- [ ] Listen for `PASTE_AND_SEND` from background
- [ ] Find composer textarea (stable selector), simulate typing via InputEvent (not direct .value assignment — React compatibility)
- [ ] Find Send button, click it
- [ ] Send `SEND_CONFIRMED` on success, `SEND_FAILED` on error
- [ ] Retry logic: 3 attempts, 500ms delay if composer not initially found

### 5.5 Manual Add Entry Point (Profile Page)
- [ ] Inject small "Add to RefLoop" icon button on LinkedIn profile pages (`/in/*`)
- [ ] On click: open same job-picker flow as Connect listener (backfill path for existing connections)

### 5.6 ATS Detector
- [ ] Regex patterns for all 7 ATS platforms (Greenhouse, Lever, Workday, SmartRecruiters, iCIMS, Ashby, Taleo)
- [ ] Extract companyJobId from each URL pattern as specified in PRD §8.1
- [ ] Return { ats, companyJobId, companyName } | null

### 5.7 ATS Add-to-Tracker Injector
- [ ] Run atsDetector on page load
- [ ] If match: inject "Add to RefLoop" button, pre-fill form (jobLink=current URL, sourceType=COMPANY_SITE, companyJobId, companyName editable, jobTitle from h1/title editable)
- [ ] Show "Already tracked" if jobLink exists

---

## Phase 6 — Toolbar Popup

### 6.1 Popup App
- [ ] Compact layout (~400×500px)
- [ ] If not signed in: "Sign in with Google" button
- [ ] If signed in:
  - "Add current page to RefLoop" form (URL pre-filled from current tab, Company Name, Job Title, Source Type, optional Job ID)
  - "Open Dashboard" button → `chrome.tabs.create` to dashboard URL
- [ ] Badge count showing READY_TO_SEND items
- [ ] User avatar/name + sign-out link

---

## Phase 7 — Dashboard (Full-Page React App)

### 7.0 App Shell
- [ ] Sign-in gate: if no UserAccount → render SignInScreen full-page
- [ ] Sidebar nav: Jobs, Launch Control, Follow-up Queue, Referral Received, History, Email Finder, Settings
- [ ] Active route highlighting; notification badges on Launch Control + Follow-up Queue
- [ ] `chrome.storage.onChanged` listener at app level → invalidate Zustand stores
- [ ] Daily send cap soft warning banner (dismissible amber banner)
- [ ] Global Toast provider

### 7.1 Zustand Stores
- [ ] `useJobsStore` — state: jobs[], loading, error; actions: loadJobs, createJob, updateJob, deleteJob, archiveJob, markReferralReceived; subscribes to storage changes
- [ ] `useContactsStore` — state: contacts[], loading; actions: loadContacts, createContact, updateContact, cancelContact; subscribes to storage changes
- [ ] `useSettingsStore` — state: settings, loading; actions: loadSettings, updateSettings
- [ ] `useAuthStore` — state: user, loading; actions: signIn, signOut, checkAuth

### 7.2 App Service
- [ ] Facade with methods for ALL user-facing actions from PRD user flows
- [ ] addJob, updateJob, archiveJob (with pending-cancel prompt), markReferralReceived (with pending-cancel prompt)
- [ ] addLinkedInContact, addEmailContact, cancelContact, removeContact
- [ ] sendMessage (posts SEND_MESSAGE_REQUEST to background), cancelQueueItem, snoozeQueueItem, overrideMessageForContact
- [ ] exportData (serialize all → JSON download), importData (parse + confirm overwrite + restore)

### 7.3 Sign-In Screen
- [ ] Centered layout, RefLoop logo, "Sign in with Google" button, value prop copy

### 7.4 Jobs Screen
- [ ] Job list: Company, Job Title, Source Type, Date Added, LinkedIn contact counts (queued/accepted/sent/expired), Email contact counts (ready/sent/expired), Status pill, Actions
- [ ] Filter: by Status, by Company name search; Sort: by date added (newest first)
- [ ] "Add Job" button → AddJobDialog (all fields from JobPosting)
- [ ] Job Detail Panel with 3 tabs: Overview, Messages, Contacts
- [ ] Overview tab: metadata, status, "Archive" button, "Received Referral" button
- [ ] Archive confirmation dialog: "Cancel N pending items for this job?"
- [ ] Received Referral confirmation: same dialog + status transition

### 7.5 Job Detail — Messages Tab
- [ ] LinkedIn sub-tab: referralMessageTemplate textarea, FU1 override textarea (placeholder shows inherited global value), FU2 override textarea; live preview panel with assembled message for every queued/ready LinkedIn contact (real firstName substituted)
- [ ] Email sub-tab: emailSubjectTemplate input, emailMessageTemplate textarea, FU1/FU2 override textareas; live preview for every queued/ready Email contact

### 7.6 Job Detail — Contacts Tab
- [ ] LinkedIn sub-tab: list with name, connectionStatus pill, outreachStatus pill, FU stages; "Add Contact" button → AddLinkedInContactDialog (profile URL, firstName, connection date editable, duplicate check)
- [ ] Emails sub-tab: list with name, email, source badge (GENERATED/MANUAL), outreach/FU status; "Add Email" → two options (Paste manually: name+address form; Generate → Email Finder pre-filled with company domain)

### 7.7 Launch Control Screen
- [ ] Cross-job, cross-channel table of ALL queued/ready/scheduled items
- [ ] Columns: Job, Contact, Channel (badge), Stage, Status pill, Scheduled For, Message Preview (expandable), Actions
- [ ] Sorting: READY_TO_SEND within send window surfaced to top
- [ ] Filters: by Job, Channel, Stage, Status
- [ ] Per-row actions: Send (enabled only when READY_TO_SEND, loading state during send), Cancel (always available → CANCELLED_BY_USER), Edit (inline message override), Snooze (datetime picker)
- [ ] Expandable row: full assembled message preview
- [ ] Bulk action: "Cancel all pending for [Job]" per job group
- [ ] Daily send cap warning banner (dismissible amber)
- [ ] Empty state

### 7.8 Follow-up Queue Screen
- [ ] Same shape as Launch Control but FU1/FU2 items only
- [ ] Visual grouping for FU1 vs FU2 sections
- [ ] All same columns, filters, per-row actions

### 7.9 Referral Received Screen
- [ ] List of REFERRAL_RECEIVED jobs: company, job title, referralReceivedAt date, "View Contacts" link
- [ ] Empty state with encouragement copy

### 7.10 History Screen
- [ ] Expired contacts, cancelled items, auto-archived jobs, manually archived/closed jobs
- [ ] Filters: by Job, Channel, terminal state (EXPIRED/CANCELLED/ARCHIVED)
- [ ] Sort by most recent terminal state
- [ ] Stats header: total reached out, accepted (LinkedIn), sent (Email), expired
- [ ] Items never deleted (permanent record per PRD §7.7 point 3)

### 7.11 Settings Screen
- [ ] Scheduling section: contactExpiryDays, followUp1DelayDays, followUp2DelayDays, sendWindowStart, sendWindowEnd (time inputs), activeDays (weekday toggles Mon-Fri default), dailySendCap (labeled "soft warning only")
- [ ] Message Templates section: greetingFormat (with {{firstName}} hint), followUp1Template textarea, followUp2Template textarea
- [ ] Account section: user avatar/name/email, sign-out button
- [ ] Data section: Export button (JSON download), Import button (file picker + confirm dialog)
- [ ] Auto-save or save-on-button with toast confirmation

### 7.12 Email Finder Screen
- [ ] Input: First Name, Middle Name (optional), Last Name (split fields), Company Domain, Company size hint select (<10 / 10-500 / 500-5000 / 5000+), "Known email?" field (paste confirmed email → lock in pattern, §9.5 gold-standard)
- [ ] Generate button → EmailPatternService.generateCandidates()
- [ ] Results: grouped by tiers (Tier 1, 2, 3, Middle); each row: email, pattern label, Copy icon, "Add to Job" button; "Copy Top 5" and "Copy All" at tier header level; inferred pattern highlighted if confirmed email provided
- [ ] "Add to Job" → job-picker (3 recent + fuzzy search), saves as Email contact with emailSource: GENERATED
- [ ] Pre-fill domain when opened from a job's Contacts tab; auto-select that job in picker

---

## Phase 8 — Integration & Wiring

### 8.1 Dashboard ↔ Background
- [ ] All dashboard mutations via appService → typed chrome.runtime.sendMessage → background routes and writes
- [ ] Dashboard `chrome.storage.onChanged` listener refreshes Zustand stores
- [ ] Service worker restart guard: re-register alarms on `chrome.runtime.onInstalled`

### 8.2 Content Script ↔ Background
- [ ] All messages use typed `ExtensionMessage` union
- [ ] Background → content script via `chrome.tabs.sendMessage(tabId, message)`

### 8.3 Popup ↔ Background
- [ ] Popup reads storage for badge count and auth state
- [ ] Form submission posts `ADD_JOB_REQUEST` to background

---

## Phase 9 — Quality & Testing

### 9.1 Unit Tests (`packages/core`)
- [ ] SchedulingService: all edge cases (weekend roll, off-hours roll, already-valid, exactly-on-window-start)
- [ ] MessageAssemblyService: firstName substitution, LinkedIn vs Email format, override vs global resolution
- [ ] HousekeepingService: expiry at boundary (14 vs 13 days), acceptance detection, FU1/FU2 transitions, auto-archive all-removed trigger, no-contacts guard, REFERRAL_RECEIVED exclusion
- [ ] EmailPatternService: normalization (diacritics, apostrophes, hyphens, suffixes), tier 1/2/3 correctness, middle-name variants, deduplication, confirmed pattern inference
- [ ] FuzzySearchService: match quality, recent companies dedup

### 9.2 Component Tests (`packages/ui`)
- [ ] DataTable: sort, filter, expandable rows, empty state
- [ ] Combobox: keyboard nav, fuzzy search
- [ ] StatusPill: correct color per status
- [ ] Dialog: focus trap, Esc closes

### 9.3 E2E Tests (Playwright)
- [ ] Sign in → Add Job → Add LinkedIn Contact → Set message template → Launch Control shows item → Send → tab opened → status SENT
- [ ] Add Email Contact → Launch Control → Send via Email → mailto opened or clipboard written
- [ ] Housekeeping marks FU1 ready after delay
- [ ] Mark Received Referral → job moves to Referral Received section

### 9.4 Code Quality
- [ ] `strict: true` TypeScript throughout, zero `any`
- [ ] ESLint zero errors, Prettier applied
- [ ] No `chrome.*` outside storage-chrome adapter, background, auth, and content scripts

---

## Phase 10 — Polish & Edge Cases

### 10.1 PRD Edge Cases
- [ ] LinkedIn name parsing: strip credentials ("MBA"), pronouns ("(she/her)"), emoji ("⭐") — first whitespace token as firstName, always editable
- [ ] Duplicate contact warning when same LinkedIn URL added to a second job
- [ ] Auto-archive guard: jobs with 0 contacts must NOT auto-archive (only when contacts.length > 0 AND all have removedAt)
- [ ] REFERRAL_RECEIVED jobs never auto-archived
- [ ] mailto body >1800 chars → clipboard fallback + toast "Copied to clipboard"
- [ ] FU scheduled for weekend → roll to Monday 9am
- [ ] Schema migrations run before any read on extension update
- [ ] Service worker restart: alarms re-registered, no in-flight state loss

### 10.2 UI Polish
- [ ] All interactive elements have unique descriptive IDs
- [ ] All buttons/icons have aria-label or visible text
- [ ] Full keyboard navigation (Tab, Enter, Escape, Arrow keys in Combobox)
- [ ] Empty states for every list/table view
- [ ] Loading skeletons while data loads
- [ ] Optimistic UI updates (immediate show, revert on error)
- [ ] Toast confirmations for: job added, contact added, message sent, item cancelled, settings saved, data exported/imported
- [ ] Responsive layout within dashboard tab

### 10.3 LinkedIn DOM Resilience (§11.2)
- [ ] All selectors in `selectors.ts` (single source of truth)
- [ ] Stable anchors: aria-label > visible text > structural position
- [ ] Retry logic on composer automation (3 attempts, 500ms delay)
- [ ] Graceful failure: log error + show popup fallback instruction

---

## Phase 11 — Documentation

- [ ] README: installation (load unpacked), OAuth setup guide (Google Cloud Console), usage guide per section
- [ ] JSDoc on all service methods referencing PRD section implemented
- [ ] Inline comments on housekeeping algorithm cross-referencing PRD §12 pseudocode
- [ ] Comment on each selector in `selectors.ts` explaining stable anchor used

---

## Completion Summary

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Project Scaffold & Tooling | `[ ]` |
| 1 | Domain Layer (core) | `[ ]` |
| 2 | Storage Adapter (storage-chrome) | `[ ]` |
| 3 | UI Component Library (ui) | `[ ]` |
| 4 | Background Service Worker | `[ ]` |
| 5 | Content Scripts | `[ ]` |
| 6 | Toolbar Popup | `[ ]` |
| 7 | Dashboard (8 views) | `[ ]` |
| 8 | Integration & Wiring | `[ ]` |
| 9 | Testing | `[ ]` |
| 10 | Polish & Edge Cases | `[ ]` |
| 11 | Documentation | `[ ]` |
