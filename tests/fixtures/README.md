# Test Fixtures

Local HTML fixtures for manual/integration crawler testing.

## Available fixture sets

- `site-alpha`
  - `chapter-1.html` -> `chapter-2.html` (no-next stop case)
- `site-beta`
  - `loop-a.html` <-> `loop-b.html` (visited-loop stop case)
- `shared/assets`
  - `base.css` and `app.js` for asset discovery checks

## Run fixture server

From repository root:

```bash
npm run fixtures:serve
```

Defaults:
- host: `127.0.0.1`
- port: `4174`

Override with env vars:

```bash
FIXTURE_HOST=0.0.0.0 FIXTURE_PORT=4174 npm run fixtures:serve
```

## Run integration checks

```bash
npm run test:fixtures
```

Coverage includes:
- alpha no-next crawl path
- beta visited-loop crawl path
- shared JS/CSS asset serving
- default route behavior and missing/traversal path handling
