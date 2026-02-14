# Content Creator — Implementation Plan & Current Status

## Goal
Build a profile-driven desktop/web app that crawls website content from a start URL and exports consolidated output (PDF/EPUB), with settings and profile management in a single-page GUI.

---

## Implementation Plan (Phased)

### Phase 0 — Bootstrap
- Monorepo scaffold and workspace setup
- SPA shell and navigation sections
- Basic settings persistence/reset flow

### Phase 1 — Profiles MVP
- Profile CRUD with domain + selector rules
- CSS/XPath manual selector inputs
- Selector test utility on sample HTML
- Profile list-first UX + create/edit form split

### Phase 2 — Crawl/Extract MVP
- Start Job flow with URL input + profile selection
- Domain-based profile auto-match from start URL
- Crawl runner loop with stop conditions:
  - no next button
  - visited URL loop prevention
  - max pages reached
  - out-of-domain blocked
- Runtime status transitions (`queued`, `running`, `completed`, `failed`)
- Result diagnostics persisted in job records

### Phase 3 — Consolidation & Export (next major build)
- Canonical document model for all extracted pages
- PDF generation pipeline
- EPUB generation pipeline
- Artifact persistence and download/open actions

### Phase 4 — Hardening
- Better retry/backoff and error handling
- Test fixtures and integration tests
- Move fetch/extraction to desktop/backend runtime (avoid browser CORS limits)

---

## Current Status (Now)

## ✅ Completed

### App shell + settings
- SPA sections: Start Job, Profile Manager, Settings, Results
- Settings read/write/reset implemented

### Profile management
- Profiles can be created, edited, deleted
- Profile Manager defaults to list view
- Create/Edit uses dedicated child editor form
- Selector test utility supports current form inputs

### Start Job UX
- URL host is parsed and matched against profile domain
- Matching profiles are filtered in dropdown
- First matching profile is auto-selected
- If no profile matches, user gets "Create new profile for this domain..." shortcut
- Shortcut routes to Profile Manager create mode

### Crawl execution
- Multi-page crawl loop is active
- Stop conditions implemented:
  - visited URL loop
  - max pages
  - no next page
  - out-of-domain guard
- Status transitions persisted: queued → running → completed/failed

### Results diagnostics
- Results show status, stop reason, errors, pages processed, last visited URL
- Per-page extracted records are stored and displayed (`url`, `preview`)
- Per-page linked asset discovery for `link[rel="stylesheet"]` and `script[src]`
- Virtual-browser crawler module (`crawler-engine`) added to capture rendered content and JS/CSS via Playwright in backend runtime, including optional content-ready waits and click interaction steps

---

## ⚠️ Known Limitation
- Web app path still fetches in browser context (CORS-limited); use `crawler-engine` virtual-browser path in backend/desktop runtime for complete rendered crawl coverage.
- Next hardening step should move fetch/extract to desktop/backend runtime (Tauri/Rust or Node sidecar) to remove this limitation.

---

## Recommended Next Steps (Priority)

1. **Consolidation layer**
   - Build canonical chapter/page model from `extractedPages`.
2. **Export MVP**
   - Implement HTML -> PDF export.
   - Implement EPUB export.
3. **Execution runtime upgrade**
   - Move crawler fetch/extract from browser to backend runtime to avoid CORS issues.
4. **Validation/testing pass**
   - Add fixture-based integration tests for crawl stop conditions and selector extraction.

---

## Milestone Snapshot
- Current milestone: **V1 Step 7**
- Practical state: **Profile-driven crawling MVP in place, export pipeline pending**.
