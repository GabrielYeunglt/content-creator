# @content-creator/crawler-engine

Virtual-browser crawling utilities for JS-rendered pages.

## `crawlWithVirtualBrowser`

Use this in a backend/desktop runtime (Node/Tauri sidecar), not inside browser UI code.

### Why

SPA/JS framework sites often return minimal HTML before hydration. This crawler uses a real headless browser runtime and waits for rendered content.

### Runtime requirement

Install Playwright in the runtime app that invokes this package:

```bash
npm i playwright
```

### Example

```ts
import { crawlWithVirtualBrowser } from '@content-creator/crawler-engine';

const result = await crawlWithVirtualBrowser({
  startUrl: 'https://example.com/docs/start',
  domain: 'example.com',
  contentRule: {
    selectorType: 'css',
    selector: 'main article',
    extractMode: 'html'
  },
  paginationRule: {
    selectorType: 'css',
    selector: 'a.next',
    attributeName: 'href'
  },
  stopRules: {
    maxPages: 50,
    maxConsecutiveErrors: 3
  },
  // Optional: wait for hydrated content to exist.
  contentReadySelector: {
    selectorType: 'css',
    selector: 'main article',
    timeoutMs: 15000
  },
  // Optional: interactions before extraction.
  interactionSteps: [
    { type: 'click', selectorType: 'css', selector: 'button.accept-cookies' }
  ]
});
```

The result includes per-page:
- extracted rendered content
- stylesheet URLs
- script URLs
