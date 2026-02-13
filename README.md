# content-creator

Initial scaffold for an experimental cross-platform content scraping application.

## Monorepo layout

- `apps/web`: Single-page GUI (React + TypeScript)
- `apps/desktop`: Desktop shell placeholder (Tauri planned)
- `packages/core`: Shared orchestration contracts
- `packages/profile-engine`: Profile/rule model and matching
- `packages/crawler-engine`: Crawl/extract pipeline interfaces
- `packages/export-engine`: PDF/EPUB export interfaces
- `packages/shared-types`: Shared domain types
- `packages/config`: Settings/defaults helpers
- `tests/fixtures`: Future integration test fixture sites
- `docs`: Architecture and implementation documentation

## Current status

This commit creates the initial project structure and baseline config files only.
Implementation will be added in subsequent steps.
