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
- Consolidation layer now builds a canonical document summary (chapter count + metadata) from extracted pages for each completed crawl job
- Export MVP advanced: export-engine now includes runtime pipelines for HTML, PDF (Playwright), EPUB (epub-gen), and manifest artifacts
- Results UI now tracks persisted exported artifact records when desktop/backend export bridge is available
- Start Job now surfaces runtime bridge readiness indicators (crawler/export) to make standalone-web limitations explicit before execution
- Results panel now includes stop-reason troubleshooting guidance for common runtime failures (missing bridge, crawl runtime error, out-of-domain)
- Crawler-engine hardening started: configurable retry/backoff per page with structured error records in crawl results
- Fixture-based integration checks now cover no-next, visited-loop, shared asset serving, default route behavior, and invalid path handling
- Added repeatable smoke validation command (`npm run test:smoke`) that runs fixture integration tests and monorepo typecheck

---

## ⚠️ Known Limitation
- Browser-only use (without running the desktop bridge service) still fails fast for crawl/export operations that require backend runtime capabilities.
- PDF/EPUB export still depends on runtime packages (`playwright`, `epub-gen`) being installed in the bridge environment.

---

## Recommended Next Steps (Priority)

1. **Consolidation layer**
   - Build canonical chapter/page model from `extractedPages`.
2. **Production packaging**
   - Package desktop bridge service into Tauri/Electron runtime distribution and startup lifecycle.
   - Finalize runtime dependency provisioning (`playwright`, `epub-gen`) across deployment targets.
3. **Validation/testing pass**
   - Expand integration tests from fixture smoke coverage to full crawl/extraction assertions and export artifact checks.

---

## Milestone Snapshot
- Current milestone: **V1 Step 9**
- Practical state: **Backend crawl/export bridge service is now implemented for local/dev runtime; production desktop packaging and deeper end-to-end coverage remain**.
