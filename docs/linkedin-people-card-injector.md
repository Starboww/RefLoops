# RefLoop — LinkedIn People Card Injector: Architecture, Issues & Root Cause Fixes

## 1. Overview & Goal

RefLoop injects small, interactive **⚡ "Add to RefLoop"** quick-action buttons into LinkedIn employee directories (such as `linkedin.com/company/{slug}/people/`, `linkedin.com/school/{slug}/people/`, and People Search results). 

Clicking the button opens the RefLoop modal overlay, pre-populating candidate details (full name, LinkedIn profile URL, and company name hint) so users can seamlessly track contacts and schedule referral outreach without leaving LinkedIn.

### Core Invariants:
1. **Strictly One Button per Profile Card**: Each employee card in the directory list must receive exactly one button, positioned cleanly at `top: 10px; right: 10px;` of the card banner.
2. **Zero False Positives**:
   - Zero buttons on the company top card / cover banner (e.g., `"Mohammad works here"`, `"DP works here"`).
   - Zero buttons in summary modules (e.g., `"People highlights"`, `"1 employee attended KIIT University"`).
   - Zero buttons in recommendation sidebars (e.g., `"dbt Labs"`, `"Snowflake"`, `"Affiliated pages"`).
3. **Robust across SPA Hydration**: Buttons must reliably inject on initial page load, dynamic React re-renders, pagination, and infinite scrolling.

---

## 2. Issues Encountered & Symptoms

During development and testing with real-world LinkedIn page dumps (`Fivetran_ People _ LinkedIn.html` and `Mojro_ People _ LinkedIn_injected.html`), three distinct failure modes were observed:

### Issue A: Duplicate Buttons on Every Employee Card
- **Symptom**: Each employee card displayed **two** buttons: one at the top-right of the card banner, and a second button placed directly beside the person's name.
- **Impact**: Cluttered visual UI, violation of the single-button requirement.

### Issue B: Buttons Appearing on Banner, Highlights, and Sidebar
- **Symptom**: Buttons were injected into:
  1. The company cover photo (`#pages.topCard` or `pages.section.StickyTopCard`) where it said `"Mohammad works here"`.
  2. The summary cards inside `"People highlights"` (`"1 employee attended KIIT University"`).
  3. Sidebar cards (`"dbt Labs"`, `"Snowflake"`).
- **Impact**: Inaccurate contact scraping; users could accidentally click to add the company itself or aggregated stats as an individual contact.

### Issue C: Buttons Disappearing Completely ("It's not coming up at all")
- **Symptom**: After an initial patch attempted to exclude highlights, 0 buttons rendered anywhere on the page.
- **Impact**: Complete feature failure on company people tabs.

---

## 3. Root Cause Analysis

### Root Cause 1: Link-First Traversal vs. Card-First Traversal (Caused Issue A)
The legacy algorithm found profile links first via `document.querySelectorAll('a[href*="/in/"]')` and then walked up the DOM tree via `while (curr)` looking for a "card container" (`isSingleCard`):

```ts
// Flawed legacy approach:
const links = document.querySelectorAll('a[href*="/in/"]');
links.forEach((link) => {
  const card = findSingleCard(link); // walked up parent nodes
  injectButton(card);
});
```

On LinkedIn's React DOM:
1. An employee card contains multiple `/in/` anchor links: one wrapping the **avatar image** (`<figure>`), one wrapping the **profile name** (`<p><span>Name</span></p>`), and sometimes one on the card cover.
2. When climbing up from the **name anchor**, `findSingleCard` stopped at the immediate heading container `<div>` because it contained 1 link and 0 buttons. It set `position: relative` and added a button **beside the name**.
3. When climbing up from the **avatar anchor**, `findSingleCard` stopped at the outer card container `[role="listitem"]`. It set `position: relative` and added a button at the **top-right of the banner**.
4. Because these were two separate DOM elements, neither saw the other's injected button or flag attribute, producing duplicate buttons.

### Root Cause 2: Substring Matching on `"connection"` (Caused Issue B)
To ensure buttons only attached to real people, the code checked for an action element (Connect, Invite, Follow, or Message):

```ts
// Flawed legacy check:
if (aria.includes('connect')) { ... }
```

In LinkedIn's `"People highlights"` carousel, summary cards had links like:
```html
<a class="k4dhn4 k4dl6n" aria-label="1 connection" href="https://www.linkedin.com/company/fivetran/people/">
  1 connection
</a>
```
Because the word `"connection"` contains the substring `"connect"` (`"1 connection".includes("connect") === true`), the algorithm mistook a summary statistic link for an actionable employee Connect button!

### Root Cause 3: The Common Ancestor Trap in Highlights Exclusions (Caused Issue C)
To prevent buttons on "People highlights", a helper function `isInsideHighlights(card)` was introduced:

```ts
// Flawed attempt that broke the entire feature:
function isInsideHighlights(card: HTMLElement): boolean {
  let curr: HTMLElement | null = card.parentElement;
  while (curr && curr !== document.body && curr.tagName !== 'MAIN') {
    const h = curr.querySelector('h2, h3');
    if (h && (h.textContent || '').toLowerCase().includes('highlight')) {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}
```

**The DOM Reality on LinkedIn:**
Under `<main id="workspace">`, LinkedIn organizes the entire people page inside a single container:
```html
<div data-testid="lazy-column" data-component-type="LazyColumn">
  <!-- Child 0: People Highlights carousel -->
  <div>
    <h2>People highlights</h2>
    ...
  </div>
  <!-- Child 1: Controls -->
  <div>...</div>
  <!-- Child 2: 1,725 associated members (The 75 employee cards) -->
  <div>
    <h2>1,725 associated members</h2>
    <div role="list">
      <div role="listitem">Vishwas Modi</div>
      <div role="listitem">Shivam Bansal</div>
      ...
    </div>
  </div>
</div>
```

When checking any real employee card (like Vishwas Modi):
1. `curr` climbed from `role="listitem"` up past `role="list"` to `<div data-testid="lazy-column">`.
2. At `<div data-testid="lazy-column">` (which is below `<main>`), `curr.querySelector('h2, h3')` searched all descendants.
3. It returned the **first** heading inside `lazy-column`, which was `<h2>People highlights</h2>` in Child 0!
4. Since `"People highlights"` contains `"highlight"`, `isInsideHighlights` returned `true` **for every single employee card in the entire directory**, rejecting all 75 employee cards and injecting 0 buttons.

---

## 4. The Solution & Architecture

The solution in `packages/extension/src/content-scripts/linkedin/companyPeopleInjector.ts` was redesigned around 5 strict invariants:

### 1. Card-First Discovery
Instead of discovering links and climbing up, we query candidate card containers directly:
```ts
const candidateCards = Array.from(
  document.querySelectorAll<HTMLElement>(
    '[role="listitem"], li.org-people-profiles-module__profile-item, li.reusable-search__result-container, .org-people-profile-card, li.org-people-profile-card__profile-card-spacing, li',
  ),
);
```

### 2. Immediate Display-Contents Rejection
Elements with `display: contents` (or `data-display-contents="true"`) generate no visual CSS box. Any `position: relative` or `position: absolute` applied to them fails or attaches to an unintended distant ancestor. They are rejected immediately:
```ts
if (card.getAttribute('data-display-contents') === 'true') return;
if (card.hasAttribute('data-refloop-card-injected')) return;
if (card.querySelector('.refloop-company-people-btn')) return;
```

### 3. Precision Exclusions & Ancestor Scoping
Excluded sections are rejected by selector matching:
```ts
if (
  card.closest(
    'header, nav, #global-nav, .global-nav, footer, aside, .scaffold-layout__aside, [id*="topCard" i], [componentkey*="topCard" i], .org-top-card, .org-people-highlights',
  )
) {
  return;
}
```

For "People highlights", we scope strictly to the immediate section containing the heading rather than bubbling up to shared ancestors:
```ts
function isInsideHighlights(card: HTMLElement): boolean {
  if (
    card.closest(
      '.org-people-highlights, [data-test-id*="highlight"], [data-testid*="highlight"], [componentkey*="highlight" i], .org-people-directory__highlights'
    )
  ) {
    return true;
  }

  const highlightHeadings = Array.from(document.querySelectorAll('h1, h2, h3')).filter((h) =>
    (h.textContent || '').toLowerCase().includes('highlight')
  );
  for (const h of highlightHeadings) {
    const section =
      h.closest('section, [data-testid="lazy-column"] > div, .artdeco-card') ||
      h.parentElement?.parentElement;
    if (section && section.contains(card)) {
      return true;
    }
  }

  return false;
}
```

### 4. Word-Boundary Action Element Validation
We test using word boundaries `\b` and explicitly reject connection count strings:
```ts
const buttons = Array.from(
  card.querySelectorAll<HTMLElement>(
    'button, a[href*="messaging/compose"], a[aria-label*="message" i]',
  ),
);
const actionEl = buttons.find((el) => {
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const text = (el.textContent || '').trim().toLowerCase();
  const href = (el.getAttribute('href') || '').toLowerCase();

  // Reject connection count links like "1 connection", "12 connections", "mutual connection"
  if (aria.includes('connection') || text.includes('connection')) {
    return false;
  }

  const actionRegex = /\b(?:connect|invite|follow|message)\b/i;
  return (
    actionRegex.test(aria) ||
    actionRegex.test(text) ||
    href.includes('messaging/compose')
  );
});
if (!actionEl) return;
```

### 5. Profile Link & Slug Uniqueness
A genuine employee card must contain at least one valid profile link and resolve to **exactly one** unique `/in/` profile slug:
```ts
const inLinks = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')).filter((a) => {
  const rawHref = a.getAttribute('href') || '';
  const textContent = (a.textContent || '').toLowerCase();
  const ariaLabel = (a.getAttribute('aria-label') || '').toLowerCase();
  return (
    rawHref.includes('/in/') &&
    !rawHref.includes('/in/unavailable/') &&
    !textContent.includes('works here') &&
    !ariaLabel.includes('works here')
  );
});
if (inLinks.length === 0) return;

const slugs = new Set<string>();
inLinks.forEach((a) => {
  const s = getProfileSlug(a.getAttribute('href') || '');
  if (s) slugs.add(s);
});
if (slugs.size !== 1) return;
```

### 6. Absolute Banner Positioning
The button is styled with:
```css
position: absolute;
top: 10px;
right: 10px;
width: 28px;
height: 28px;
border-radius: 50%;
background: linear-gradient(135deg, #FF3C6B 0%, #FF2458 100%);
color: #ffffff;
box-shadow: 0 2px 8px rgba(255, 60, 107, 0.4);
z-index: 100;
```
It is appended directly to the `card` container (with `position: relative`), placing it in the top-right corner of the profile card banner.

---

## 5. Verification & Test Data

The fix was rigorously validated against the two DOM datasets provided:

| Metric | `Fivetran_ People _ LinkedIn.html` | `Mojro_ People _ LinkedIn_injected.html` |
| :--- | :---: | :---: |
| **Total Candidates Evaluated** | 128 | 117 |
| **Real Employee Cards Injected** | **75 of 75** | **55 of 55** |
| **Buttons on Company Top Card** | **0** | **0** |
| **Buttons in People Highlights** | **0** | **0** |
| **Buttons in Sidebars / Recommendations** | **0** | **0** |
| **Duplicate Buttons** | **0** | **0** |

### Automated Codebase Health:
- `pnpm run typecheck`: **0 errors** across all workspace packages (`@refloop/core`, `@refloop/ui`, `@refloop/storage-chrome`, `@refloop/extension`).
- `pnpm run test`: **61/61 unit and integration tests passing**.
- `pnpm run build`: Extension production bundle compiled in **~1.1s**.

---

## 6. Developer Guidelines for Future Changes

When modifying content script DOM injection or page classification on LinkedIn:
1. **Never use `element.querySelector` on parent nodes in loops** without verifying whether that parent is a common page wrapper (like `LazyColumn` or `scaffold-layout`).
2. **Never match substrings on common words** (e.g. `connect` vs `connection`, `follow` vs `followers`). Always use `\b` regex boundaries.
3. **Always stamp injected DOM nodes** with unique data attributes (`data-refloop-card-injected="slug"`) to guarantee idempotency across SPA route changes and MutationObserver events.
4. **Never attach positioned elements to `display: contents` tags**.
