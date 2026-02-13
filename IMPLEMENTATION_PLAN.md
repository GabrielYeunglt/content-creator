# Experimental Web Content Scraper & PDF/EPUB Exporter — Implementation Plan (v1)

## 1) Confirmed Product Direction

This plan reflects the clarified requirements:

1. **Selector support:** CSS + XPath in v1 (manual input), with architecture that leaves room for a future XPath visual builder.
2. **Rule authoring:** manual selectors in v1 (no click-to-select builder yet).
3. **Authentication:** no login/session handling in v1.
4. **Crawl scope:** strictly constrained to the starting domain.
5. **Manual page reordering:** desired but deferred (not in v1).

---

## 2) Recommended Stack (v1)

**Preferred:** TypeScript end-to-end

- **Desktop container:** Tauri (cross-platform, lightweight)
- **SPA UI:** React + Vite
- **Scraper runtime:** Playwright (for rendered pages) + Cheerio (for static parsing/cleanup)
- **Persistence:** SQLite (jobs, profiles, settings) + JSON import/export for profiles
- **PDF export:** Playwright HTML-to-PDF
- **EPUB export:** EPUB generator library (e.g., epub-gen) from normalized chapter model

Why this stack:
- One language across UI and backend logic
- Strong scraping ecosystem for CSS/XPath and browser automation
- Easy iteration for profile-driven scraping

---

## 3) Architecture Overview

### 3.1 Modules

1. **UI (SPA)**
   - Start Job view
   - Profile Manager
   - Settings view
   - Job History & Export view

2. **App Services**
   - Job orchestrator
   - Validation and policy checks
   - Progress/log event stream

3. **Profile Engine**
   - Domain matching
   - Selector and pagination rule interpreter
   - Stop-condition evaluator

4. **Crawler/Scraper Engine**
   - Queue + visited URL tracking
   - Page fetcher (browser/static)
   - Content extraction + normalization

5. **Export Engine**
   - Canonical book/document model builder
   - PDF generator
   - EPUB generator

6. **Data Layer**
   - Settings repository
   - Profiles repository
   - Jobs/artifacts repository

---

## 4) Data Model (v1)

### 4.1 AppSettings
- `outputDir`
- `maxPagesDefault`
- `requestTimeoutMs`
- `delayMsBetweenPages`
- `strictDomainOnly` (default true)
- `defaultExportFormat` (`pdf`, `epub`, `both`)
- `concurrency` (default 1 for v1 safety)

### 4.2 WebsiteProfile
- `id`
- `name`
- `domain` (exact/normalized host)
- `description`
- `selectorRules[]`
- `paginationRule`
- `stopRules`
- `cleanupRules[]`
- `createdAt`, `updatedAt`

### 4.3 SelectorRule
- `fieldName` (title/body/author/date/custom)
- `selectorType` (`css` | `xpath`)
- `selector`
- `extractMode` (`text` | `html` | `attribute`)
- `attributeName` (optional)
- `required` (boolean)
- `postProcess[]` (trim, regex replace, collapse whitespace)

### 4.4 PaginationRule
- `mode` (`next-button` for v1)
- `selectorType` (`css` | `xpath`)
- `selector`
- `extractHrefFrom` (`self` or `attribute`)
- `attributeName` (default `href`)

### 4.5 StopRules
- `stopWhenNoNextButton` (true)
- `stopWhenUrlVisited` (true)
- `maxPages` (profile override or settings default)
- `maxConsecutiveErrors`

### 4.6 ScrapeJob
- `id`
- `profileId`
- `startUrl`
- `status` (`queued|running|completed|failed|cancelled`)
- `pagesProcessed`
- `pagesSkipped`
- `startedAt`, `endedAt`
- `logPath`

### 4.7 ExtractedPage
- `jobId`
- `pageIndex` (crawl order)
- `url`
- `title`
- `bodyHtml`
- `metadataJson`

---

## 5) Scraping Flow (v1, profile-driven)

1. User enters **start URL**.
2. App matches URL host to profile domain.
3. App validates the profile has at least one content selector and pagination rule.
4. Initialize crawl state:
   - `currentUrl = startUrl`
   - `visited = set()`
   - `results = []`
5. For each iteration:
   - If URL outside domain scope, stop/fail per policy.
   - Fetch page with Playwright (primary mode for reliability).
   - Extract content fields via selector rules (CSS/XPath).
   - Normalize and store page result.
   - Evaluate next-page selector.
   - Apply stop conditions:
     - no next button
     - next URL already visited
     - max pages reached
     - too many errors
   - Move to next URL.
6. Consolidate extracted pages by crawl order.
7. Generate PDF and/or EPUB from consolidated document model.
8. Save artifacts and job report.

---

## 6) Domain Scope Enforcement (required)

Because v1 must remain in-domain:
- Normalize URLs before comparison.
- Compare effective host against profile domain policy.
- Reject cross-domain next links by default.
- Optional advanced policy later: allow subdomains toggle.

v1 policy recommendation:
- `strictDomainOnly = true`
- Allowed hosts: exact match + `www.` variant only.

---

## 7) UI Plan (Single Page App)

### 7.1 Start Job
- Input: start URL
- Profile dropdown (auto-select by domain, user override allowed)
- Export format selection
- Run button + live status panel (progress/logs)

### 7.2 Profile Manager
- Create/edit/delete profile
- Manual selector inputs for each field
- Selector type toggle (CSS/XPath)
- Pagination next-button selector config
- Stop rules configuration
- "Test selectors" button on sample URL

### 7.3 Settings
- General runtime settings
- Read/write persistent settings
- **Reset to Defaults** button (required)

### 7.4 Results
- Job history list
- Export artifacts (open file location)
- Basic extraction summary (page count, failures)

---

## 8) Validation Rules (important)

### 8.1 Profile Save Validation
- Domain must be valid host
- At least one required content selector (e.g., `body`)
- Pagination selector required for multi-page flow
- XPath selector compile check where possible

### 8.2 Runtime Validation
- Start URL must match selected profile domain
- Reject missing/invalid next-page URL
- Resolve relative links safely
- Prevent loops via visited URL set

---

## 9) Export Strategy

### 9.1 Canonical Intermediate Model
Build a canonical structure first:
- document metadata (title/author/language)
- ordered chapters/pages
- cleaned HTML blocks

This prevents PDF/EPUB divergence and simplifies testing.

### 9.2 PDF
- Render canonical HTML template
- Generate PDF with consistent page margins/fonts

### 9.3 EPUB
- Map each page/chapter to EPUB section
- Include toc.ncx/nav + metadata
- Embed local assets only if downloaded

---

## 10) Phased Delivery Plan

### Phase 0 — Project bootstrap (3–5 days)
- Create desktop shell + SPA
- Setup data storage and logging
- Implement settings store with reset defaults

### Phase 1 — Profiles MVP (5–7 days)
- Profile CRUD
- CSS/XPath manual rules UI
- Rule validation + sample page test

### Phase 2 — Crawl/Extract MVP (7–10 days)
- Queue loop with visited-set and max pages
- Domain-only enforcement
- Content extraction pipeline
- Live progress/log updates

### Phase 3 — Export MVP (5–7 days)
- Canonical model assembly
- PDF + EPUB generation
- Artifact persistence and job history

### Phase 4 — Hardening (5–7 days)
- Retry/backoff
- Better error messages
- Test fixtures for 2–3 sample domains

---

## 11) Test Plan (v1)

### 11.1 Unit Tests
- Selector executor (CSS/XPath)
- URL normalization and domain checks
- Stop condition evaluator
- Settings reset behavior

### 11.2 Integration Tests
- Profile + crawl flow on local fixture site
- Pagination stop on no-next
- Loop prevention on repeated URL
- Export generation sanity checks (file produced, non-empty)

### 11.3 Manual QA Checklist
- Create profile, run scrape, export PDF/EPUB
- Reset settings and verify defaults restored
- Confirm out-of-domain link is blocked

---

## 12) Post-v1 Backlog (already identified)

1. Visual selector picker
2. XPath builder UX
3. Manual page/chapter reordering before export
4. Advanced pagination patterns (URL templates, load-more)
5. Optional subdomain policy and include/exclude path rules
6. Auth/session support (if needed later)

---

## 13) Requirement Clarification Summary (captured)

- ✅ CSS + XPath supported in v1 (manual input)
- ✅ Future-proof design for XPath builder
- ✅ No auth/login in v1
- ✅ Crawl constrained to starting domain
- ✅ Manual reorder requested but deferred to post-v1

