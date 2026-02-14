export type CrawlStopReason =
  | 'no-next-button'
  | 'already-visited-url'
  | 'max-pages-reached'
  | 'error-threshold-reached'
  | 'out-of-domain-blocked';

export type SelectorType = 'css' | 'xpath';
export type ExtractMode = 'text' | 'html' | 'attribute';

export type CrawlSelectorRule = {
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName?: string;
};

export type CrawlPaginationRule = {
  selectorType: SelectorType;
  selector: string;
  attributeName: string;
};

export type CrawlStopRules = {
  maxPages: number;
  maxConsecutiveErrors: number;
};

export type VirtualBrowserCrawlOptions = {
  startUrl: string;
  domain: string;
  contentRule: CrawlSelectorRule;
  paginationRule: CrawlPaginationRule;
  stopRules: CrawlStopRules;
  timeoutMs?: number;
};

export type CrawledPage = {
  url: string;
  content: string;
  stylesheets: string[];
  scripts: string[];
};

export type CrawlResult = {
  pagesProcessed: number;
  stopReason: CrawlStopReason;
  pages: CrawledPage[];
};

type PlaywrightLike = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<{
      newContext: () => Promise<{
        newPage: () => Promise<{
          goto: (url: string, opts: { waitUntil: 'networkidle'; timeout: number }) => Promise<void>;
          on: (event: 'requestfinished', handler: (request: { resourceType(): string; url(): string }) => void) => void;
          off: (event: 'requestfinished', handler: (request: { resourceType(): string; url(): string }) => void) => void;
          evaluate: <TResult, TArg = undefined>(fn: (arg: TArg) => TResult, arg?: TArg) => Promise<TResult>;
        }>;
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

async function loadPlaywright(): Promise<PlaywrightLike> {
  try {
    const module = (await import('playwright')) as unknown;
    return module as PlaywrightLike;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Playwright import error';
    throw new Error(
      `Virtual browser crawl requires the 'playwright' package in the runtime environment. ${message}`
    );
  }
}

function normalizedHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function toAbsoluteUrl(baseUrl: string, value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function crawlWithVirtualBrowser(options: VirtualBrowserCrawlOptions): Promise<CrawlResult> {
  const { chromium } = await loadPlaywright();
  const {
    startUrl,
    domain,
    contentRule,
    paginationRule,
    stopRules,
    timeoutMs = 30000
  } = options;

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];

  let currentUrl: string | null = startUrl;
  let consecutiveErrors = 0;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    while (currentUrl) {
      if (visited.has(currentUrl)) {
        return { pagesProcessed: pages.length, stopReason: 'already-visited-url', pages };
      }

      if (pages.length >= Math.max(1, stopRules.maxPages)) {
        return { pagesProcessed: pages.length, stopReason: 'max-pages-reached', pages };
      }

      const host = normalizedHost(currentUrl);
      if (!host || host !== domain.replace(/^www\./, '').toLowerCase()) {
        return { pagesProcessed: pages.length, stopReason: 'out-of-domain-blocked', pages };
      }

      const networkStylesheets = new Set<string>();
      const networkScripts = new Set<string>();
      const requestHandler = (request: { resourceType(): string; url(): string }) => {
        const type = request.resourceType();
        if (type === 'stylesheet') networkStylesheets.add(request.url());
        if (type === 'script') networkScripts.add(request.url());
      };

      page.on('requestfinished', requestHandler);

      try {
        await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: timeoutMs });
        visited.add(currentUrl);

        const content = await page.evaluate(
          ({ selectorType, selector, extractMode, attributeName }) => {
            const firstNode = selectorType === 'css'
              ? document.querySelector(selector)
              : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if (!firstNode || !(firstNode instanceof Element)) return null;
            if (extractMode === 'html') return firstNode.innerHTML.trim();
            if (extractMode === 'text') return (firstNode.textContent ?? '').trim();
            const attr = (attributeName ?? 'href').trim();
            return firstNode.getAttribute(attr)?.trim() ?? '';
          },
          contentRule
        );

        const nextValue = await page.evaluate(
          ({ selectorType, selector, attributeName }) => {
            const firstNode = selectorType === 'css'
              ? document.querySelector(selector)
              : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if (!firstNode || !(firstNode instanceof Element)) return '';
            return firstNode.getAttribute(attributeName)?.trim() ?? '';
          },
          paginationRule
        );

        const domAssets = await page.evaluate(() => {
          const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
            .map((node) => node.getAttribute('href') ?? '')
            .map((href) => href.trim())
            .filter(Boolean)
            .map((href) => {
              try { return new URL(href, window.location.href).toString(); } catch { return null; }
            })
            .filter((value): value is string => Boolean(value));

          const scripts = Array.from(document.querySelectorAll('script[src]'))
            .map((node) => node.getAttribute('src') ?? '')
            .map((src) => src.trim())
            .filter(Boolean)
            .map((src) => {
              try { return new URL(src, window.location.href).toString(); } catch { return null; }
            })
            .filter((value): value is string => Boolean(value));

          return { stylesheets, scripts };
        });

        pages.push({
          url: currentUrl,
          content: content ?? '',
          stylesheets: Array.from(new Set([...domAssets.stylesheets, ...networkStylesheets])),
          scripts: Array.from(new Set([...domAssets.scripts, ...networkScripts]))
        });

        consecutiveErrors = 0;
        const resolvedNext = toAbsoluteUrl(currentUrl, nextValue);
        if (!resolvedNext) {
          return { pagesProcessed: pages.length, stopReason: 'no-next-button', pages };
        }

        currentUrl = resolvedNext;
      } catch {
        consecutiveErrors += 1;
        if (consecutiveErrors >= Math.max(1, stopRules.maxConsecutiveErrors)) {
          return { pagesProcessed: pages.length, stopReason: 'error-threshold-reached', pages };
        }
      } finally {
        page.off('requestfinished', requestHandler);
      }
    }

    return { pagesProcessed: pages.length, stopReason: 'no-next-button', pages };
  } finally {
    await context.close();
    await browser.close();
  }
}
