export type CrawlStopReason =
  | 'no-next-button'
  | 'already-visited-url'
  | 'max-pages-reached'
  | 'error-threshold-reached'
  | 'out-of-domain-blocked'
  | 'total-pages-reached';

export type SelectorType = 'css' | 'xpath';
export type ExtractMode = 'text' | 'html' | 'attribute';

export type CrawlSelectorRule = {
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName?: string;
  attributeUrlMode?: 'value' | 'fetch-image-data-url';
};

export type CrawlMetadataRule = {
  fieldType: 'title' | 'author' | 'chapter' | 'publisher' | 'series' | 'cover' | 'language' | 'description' | 'other';
  customFieldName?: string;
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName?: string;
  attributeUrlMode?: 'value' | 'fetch-image-data-url';
};

export type CrawlPaginationRule = {
  selectorType: SelectorType;
  selector: string;
  attributeName: string;
  navigationMode?: 'url-attribute' | 'click';
};

export type CrawlTotalPagesRule = {
  selectorType: SelectorType;
  selector: string;
  attributeName?: string;
};

export type CrawlStopRules = {
  maxPages: number;
  maxConsecutiveErrors: number;
  maxRetriesPerPage?: number;
  retryBackoffMs?: number;
};

export type CrawlInteractionStep = {
  type: 'click';
  selectorType: SelectorType;
  selector: string;
  timeoutMs?: number;
};

export type VirtualBrowserCrawlOptions = {
  startUrl: string;
  domain: string;
  contentRule: CrawlSelectorRule;
  paginationRule: CrawlPaginationRule;
  stopRules: CrawlStopRules;
  timeoutMs?: number;
  contentReadySelector?: {
    selectorType: SelectorType;
    selector: string;
    timeoutMs?: number;
  };
  interactionSteps?: CrawlInteractionStep[];
  metadataRules?: CrawlMetadataRule[];
  totalPagesRule?: CrawlTotalPagesRule;
};

export type CrawledPage = {
  url: string;
  content: string;
  stylesheets: string[];
  scripts: string[];
  metadata?: Record<string, string>;
};

export type CrawlErrorRecord = {
  url: string;
  attempt: number;
  error: string;
};

export type CrawlResult = {
  pagesProcessed: number;
  stopReason: CrawlStopReason;
  pages: CrawledPage[];
  errors: CrawlErrorRecord[];
  notes: string[];
};

type RequestLike = {
  resourceType(): string;
  url(): string;
};

type PlaywrightPageLike = {
  goto: (url: string, opts: { waitUntil: 'networkidle'; timeout: number }) => Promise<void>;
  on: (event: 'requestfinished', handler: (request: RequestLike) => void) => void;
  off: (event: 'requestfinished', handler: (request: RequestLike) => void) => void;
  evaluate: <TResult, TArg = undefined>(fn: (arg: TArg) => TResult | Promise<TResult>, arg?: TArg) => Promise<TResult>;
  waitForSelector: (selector: string, opts: { timeout: number }) => Promise<unknown>;
  click: (selector: string, opts: { timeout: number }) => Promise<void>;
  waitForTimeout: (timeout: number) => Promise<void>;
  context: () => {
    request: {
      get: (url: string, opts?: { headers?: Record<string, string> }) => Promise<{
        ok: () => boolean;
        status: () => number;
        headers: () => Record<string, string>;
        body: () => Promise<Uint8Array>;
      }>;
    };
  };
};

type PlaywrightLike = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<{
      newContext: () => Promise<{
        newPage: () => Promise<PlaywrightPageLike>;
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
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

async function resolveNextUrl(params: {
  page: PlaywrightPageLike;
  currentUrl: string;
  paginationRule: CrawlPaginationRule;
  timeoutMs: number;
}): Promise<string | null> {
  const { page, currentUrl, paginationRule, timeoutMs } = params;

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

  const resolvedFromAttribute = toAbsoluteUrl(currentUrl, nextValue);
  if (resolvedFromAttribute) {
    return resolvedFromAttribute;
  }

  const beforeClickUrl = await page.evaluate(() => window.location.href);
  const nextSelector = toCssSelector(paginationRule.selectorType, paginationRule.selector);
  await page.waitForSelector(nextSelector, { timeout: timeoutMs });
  await page.click(nextSelector, { timeout: timeoutMs });
  await page.waitForTimeout(400);
  const afterClickUrl = await page.evaluate(() => window.location.href);

  if (afterClickUrl === beforeClickUrl) {
    return null;
  }

  return toAbsoluteUrl(currentUrl, afterClickUrl);
}



async function extractTotalPages(page: PlaywrightPageLike, rule: CrawlTotalPagesRule): Promise<number | null> {
  const rawValue = await page.evaluate(
    ({ selectorType, selector, attributeName }) => {
      const firstNode = selectorType === 'css'
        ? document.querySelector(selector)
        : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

      if (!firstNode || !(firstNode instanceof Element)) return '';

      if (attributeName?.trim()) {
        return firstNode.getAttribute(attributeName)?.trim() ?? '';
      }

      return (firstNode.textContent ?? '').trim();
    },
    rule
  );

  const matched = rawValue.match(/\d+/);
  if (!matched) {
    return null;
  }

  const parsed = Number.parseInt(matched[0], 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function toCssSelector(selectorType: SelectorType, selector: string): string {
  if (selectorType === 'css') {
    return selector;
  }

  return `xpath=${selector}`;
}

export async function crawlWithVirtualBrowser(options: VirtualBrowserCrawlOptions): Promise<CrawlResult> {
  const { chromium } = await loadPlaywright();
  const {
    startUrl,
    domain,
    contentRule,
    paginationRule,
    stopRules,
    timeoutMs = 30000,
    contentReadySelector,
    interactionSteps = [],
    metadataRules = [],
    totalPagesRule
  } = options;

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const errors: CrawlErrorRecord[] = [];
  const notes: string[] = [];

  let currentUrl: string | null = startUrl;
  let totalPagesTarget: number | null = null;
  let consecutiveErrors = 0;

  const maxRetriesPerPage = Math.max(0, stopRules.maxRetriesPerPage ?? 1);
  const retryBackoffMs = Math.max(0, stopRules.retryBackoffMs ?? 750);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    while (currentUrl) {
      if (visited.has(currentUrl)) {
        return { pagesProcessed: pages.length, stopReason: 'already-visited-url', pages, errors, notes };
      }

      if (pages.length >= Math.max(1, stopRules.maxPages)) {
        return { pagesProcessed: pages.length, stopReason: 'max-pages-reached', pages, errors, notes };
      }

      const host = normalizedHost(currentUrl);
      if (!host || host !== domain.replace(/^www\./, '').toLowerCase()) {
        return { pagesProcessed: pages.length, stopReason: 'out-of-domain-blocked', pages, errors, notes };
      }

      const networkStylesheets = new Set<string>();
      const networkScripts = new Set<string>();
      const requestHandler = (request: RequestLike) => {
        const type = request.resourceType();
        if (type === 'stylesheet') networkStylesheets.add(request.url());
        if (type === 'script') networkScripts.add(request.url());
      };

      page.on('requestfinished', requestHandler);

      try {
        for (let attempt = 1; attempt <= maxRetriesPerPage + 1; attempt += 1) {
          try {
            await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: timeoutMs });

            for (const step of interactionSteps) {
              if (step.type === 'click') {
                const stepSelector = toCssSelector(step.selectorType, step.selector);
                const stepTimeout = step.timeoutMs ?? 5000;
                await page.waitForSelector(stepSelector, { timeout: stepTimeout });
                await page.click(stepSelector, { timeout: stepTimeout });
                await page.waitForTimeout(300);
              }
            }

            if (contentReadySelector) {
              const readySelector = toCssSelector(contentReadySelector.selectorType, contentReadySelector.selector);
              await page.waitForSelector(readySelector, { timeout: contentReadySelector.timeoutMs ?? timeoutMs });
            }

            visited.add(currentUrl);
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown crawl attempt error';
            errors.push({ url: currentUrl, attempt, error: message });

            if (attempt > maxRetriesPerPage) {
              throw error;
            }

            if (retryBackoffMs > 0) {
              await page.waitForTimeout(retryBackoffMs * attempt);
            }
          }
        }

        const extractedValue = await page.evaluate(
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

        const content = await resolveContentValue({
          page,
          baseUrl: currentUrl,
          contentRule,
          extractedValue,
          timeoutMs
        });

        const metadata: Record<string, string> = {};
        for (const rule of metadataRules) {
          const metadataKey = resolveMetadataKey(rule);
          if (!metadataKey) {
            continue;
          }

          const extractedMetadata = await page.evaluate(
            ({ selectorType, selector, extractMode, attributeName }) => {
              const firstNode = selectorType === 'css'
                ? document.querySelector(selector)
                : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

              if (!firstNode || !(firstNode instanceof Element)) return '';
              if (extractMode === 'html') return firstNode.innerHTML.trim();
              if (extractMode === 'text') return (firstNode.textContent ?? '').trim();
              const attr = (attributeName ?? 'href').trim();
              return firstNode.getAttribute(attr)?.trim() ?? '';
            },
            rule
          );

          const resolvedMetadataValue = await resolveContentValue({
            page,
            baseUrl: currentUrl,
            contentRule: rule,
            extractedValue: extractedMetadata,
            timeoutMs
          });

          if (resolvedMetadataValue.trim()) {
            metadata[metadataKey] = resolvedMetadataValue;
          }
        }

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
          scripts: Array.from(new Set([...domAssets.scripts, ...networkScripts])),
          metadata
        });

        consecutiveErrors = 0;

        if (totalPagesRule && totalPagesTarget === null) {
          const extractedTotalPages = await extractTotalPages(page, totalPagesRule);
          if (extractedTotalPages !== null) {
            totalPagesTarget = extractedTotalPages;
            notes.push(`Total pages target extracted: ${extractedTotalPages}.`);
          }
        }

        if (totalPagesTarget !== null && pages.length >= totalPagesTarget) {
          notes.push(`Reached extracted total pages target (${totalPagesTarget}).`);
          return { pagesProcessed: pages.length, stopReason: 'total-pages-reached', pages, errors, notes };
        }

        const resolvedNext = await resolveNextUrl({
          page,
          currentUrl,
          paginationRule,
          timeoutMs
        });
        if (!resolvedNext) {
          return { pagesProcessed: pages.length, stopReason: 'no-next-button', pages, errors, notes };
        }

        currentUrl = resolvedNext;
      } catch (error) {
        consecutiveErrors += 1;
        const message = error instanceof Error ? error.message : 'Unknown crawl processing error';
        errors.push({ url: currentUrl, attempt: maxRetriesPerPage + 1, error: message });

        if (consecutiveErrors >= Math.max(1, stopRules.maxConsecutiveErrors)) {
          return { pagesProcessed: pages.length, stopReason: 'error-threshold-reached', pages, errors, notes };
        }
      } finally {
        page.off('requestfinished', requestHandler);
      }
    }

    return { pagesProcessed: pages.length, stopReason: 'no-next-button', pages, errors, notes };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function resolveContentValue(params: {
  page: PlaywrightPageLike;
  baseUrl: string;
  contentRule: Pick<CrawlSelectorRule, 'extractMode' | 'attributeUrlMode'>;
  extractedValue: string | null;
  timeoutMs: number;
}): Promise<string> {
  const { page, baseUrl, contentRule, extractedValue, timeoutMs } = params;
  const raw = extractedValue ?? '';

  if (contentRule.extractMode !== 'attribute') {
    return raw;
  }

  if (contentRule.attributeUrlMode !== 'fetch-image-data-url') {
    return raw;
  }

  const absoluteUrl = toAbsoluteUrl(baseUrl, raw);
  if (!absoluteUrl) {
    return raw;
  }

  try {
    const response = await page.context().request.get(absoluteUrl, {
      headers: {
        referer: baseUrl,
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok()) {
      return absoluteUrl;
    }

    const headers = response.headers();
    const contentType = (headers['content-type'] ?? headers['Content-Type'] ?? '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return absoluteUrl;
    }

    const body = await Promise.race([
      response.body(),
      new Promise<Uint8Array>((_, reject) => setTimeout(() => reject(new Error('Timed out fetching image body')), timeoutMs))
    ]);

    const BufferCtor = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
    if (!BufferCtor) {
      return absoluteUrl;
    }

    return `data:${contentType};base64,${BufferCtor.from(body).toString('base64')}`;
  } catch {
    return absoluteUrl;
  }
}

function resolveMetadataKey(rule: CrawlMetadataRule): string {
  if (rule.fieldType === 'other') {
    return (rule.customFieldName ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  return rule.fieldType;
}
