# Desktop Bridge Service

This app now provides a runnable backend bridge for crawling and exports.

## What it does

- Exposes `POST /crawl` and runs `crawlWithVirtualBrowser(...)` from `@content-creator/crawler-engine` in Node.
- Exposes `POST /export` and runs `runExportPipeline(...)` from `@content-creator/export-engine`.
- Exposes `GET /health` for bridge readiness checks.

The web app (`apps/web`) can auto-connect to this service and register:

- `window.__CONTENT_CREATOR_DESKTOP_CRAWLER__`
- `window.__CONTENT_CREATOR_DESKTOP_EXPORT__`

when health checks pass.

## Run

```bash
npm --workspace @content-creator/desktop run dev
```

Defaults:

- Host: `127.0.0.1`
- Port: `8787`
- Artifact output dir: `.content-creator-artifacts`

Environment variables:

- `CONTENT_CREATOR_BRIDGE_HOST`
- `CONTENT_CREATOR_BRIDGE_PORT`
- `CONTENT_CREATOR_ARTIFACTS_DIR`

## Runtime dependencies

This service expects runtime dependencies used by crawl/export packages to be installed in your environment:

- `playwright` (crawl + PDF export)
- `epub-gen` (EPUB export)
