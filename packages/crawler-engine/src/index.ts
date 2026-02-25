export type CrawlStopReason =
  | 'no-next-button'
  | 'already-visited-url'
  | 'max-pages-reached'
  | 'error-threshold-reached'
  | 'out-of-domain-blocked'
  | 'total-pages-reached'
  | 'cancelled';

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
  fieldType: 'title' | 'author' | 'volume' | 'chapter' | 'publisher' | 'series' | 'subject' | 'cover' | 'language' | 'description' | 'other';
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
  navigationMode?: 'url-attribute' | 'click' | 'url-pattern';
  postNavigationDelaySeconds?: number;
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
  jobId?: string;
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
  onPageCrawled?: (payload: {
    pagesProcessed: number;
    totalPages?: number;
    currentUrl?: string;
  }) => void;
  abortSignal?: AbortSignal;
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
  goto: (url: string, opts: { waitUntil: 'commit' | 'domcontentloaded' | 'networkidle'; timeout: number }) => Promise<void>;
  reload: (opts: { waitUntil: 'commit' | 'domcontentloaded' | 'networkidle'; timeout: number }) => Promise<void>;
  on: (event: 'requestfinished', handler: (request: RequestLike) => void) => void;
  off: (event: 'requestfinished', handler: (request: RequestLike) => void) => void;
  evaluate: <TResult, TArg = undefined>(fn: (arg: TArg) => TResult | Promise<TResult>, arg?: TArg) => Promise<TResult>;
  waitForSelector: (selector: string, opts: { timeout: number; state?: 'attached' | 'visible' }) => Promise<unknown>;
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

class CrawlCancelledError extends Error {
  constructor() {
    super('Crawl cancelled by user request.');
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CrawlCancelledError();
  }
}

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



function stripHash(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function isHashOnlyNavigation(previousUrl: string | null, nextUrl: string): boolean {
  if (!previousUrl || previousUrl === nextUrl) {
    return false;
  }

  return stripHash(previousUrl) === stripHash(nextUrl);
}

async function extractRuleValue(
  page: PlaywrightPageLike,
  rule: Pick<CrawlSelectorRule, 'selectorType' | 'selector' | 'extractMode' | 'attributeName'>
): Promise<string | null> {
  return page.evaluate(
    ({ selectorType, selector, extractMode, attributeName }) => {
      let firstNode: Node | null = null;
      try {
        firstNode = selectorType === 'css'
          ? document.querySelector(selector)
          : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch {
        return null;
      }

      if (!firstNode || !(firstNode instanceof Element)) return null;
      if (extractMode === 'html') return firstNode.innerHTML.trim();
      if (extractMode === 'text') return (firstNode.textContent ?? '').trim();
      const attr = (attributeName ?? 'href').trim();
      return firstNode.getAttribute(attr)?.trim() ?? '';
    },
    rule
  );
}

async function waitForDifferentRuleValue(params: {
  page: PlaywrightPageLike;
  rule: Pick<CrawlSelectorRule, 'selectorType' | 'selector' | 'extractMode' | 'attributeName'>;
  previousValue: string;
  timeoutMs: number;
}): Promise<string | null> {
  const { page, rule, previousValue, timeoutMs } = params;
  const startedAt = Date.now();
  let latestValue = previousValue;

  while (Date.now() - startedAt < timeoutMs) {
    await page.waitForTimeout(200);
    const candidate = await extractRuleValue(page, rule);

    if (candidate && candidate !== previousValue) {
      return candidate;
    }

    if (candidate) {
      latestValue = candidate;
    }
  }

  return latestValue;
}

function resolveUrlPatternNext(currentUrl: string): string | null {
  try {
    const url = new URL(currentUrl);
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const params = new URLSearchParams(hash);
    const rawPage = params.get('p');
    const currentPage = Number.parseInt(rawPage ?? '1', 10);
    const safeCurrentPage = Number.isFinite(currentPage) && currentPage >= 1 ? currentPage : 1;
    params.set('p', String(safeCurrentPage + 1));
    url.hash = params.toString();
    return url.toString();
  } catch {
    return null;
  }
}


function resolveNavigationWaitUntil(mode: CrawlPaginationRule['navigationMode']): 'commit' | 'domcontentloaded' {
  return mode === 'url-pattern' ? 'commit' : 'domcontentloaded';
}

async function resolveNextUrl(params: {
  page: PlaywrightPageLike;
  currentUrl: string;
  paginationRule: CrawlPaginationRule;
  timeoutMs: number;
}): Promise<string | null> {
  const { page, currentUrl, paginationRule, timeoutMs } = params;

  if (paginationRule.navigationMode === 'url-pattern') {
    return resolveUrlPatternNext(currentUrl);
  }

  const nextValue = await page.evaluate(
    ({ selectorType, selector, attributeName }) => {
      let firstNode: Node | null = null;
      try {
        firstNode = selectorType === 'css'
          ? document.querySelector(selector)
          : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch {
        return '';
      }

      if (!firstNode || !(firstNode instanceof Element)) return '';
      return firstNode.getAttribute(attributeName)?.trim() ?? '';
    },
    paginationRule
  );

  const resolvedFromAttribute = toAbsoluteUrl(currentUrl, nextValue);
  if (resolvedFromAttribute) {
    return resolvedFromAttribute;
  }

  if (paginationRule.navigationMode === 'url-attribute') {
    return null;
  }

  const getPageState = async () => page.evaluate(() => {
    const select = document.querySelector('#pageSelect');
    const selectedValue = select instanceof HTMLSelectElement ? (select.value || '') : '';
    const pageIndicator = (document.querySelector('#page')?.textContent ?? '').trim();
    return {
      href: window.location.href,
      selectedValue,
      pageIndicator
    };
  });

  const before = await getPageState();
  const nextSelector = toCssSelector(paginationRule.selectorType, paginationRule.selector);
  await page.waitForSelector(nextSelector, { timeout: timeoutMs });
  await page.click(nextSelector, { timeout: timeoutMs });
  await page.waitForTimeout(500);
  const afterClick = await getPageState();

  const resolvedAfterClick = toAbsoluteUrl(currentUrl, afterClick.href);
  if (resolvedAfterClick && resolvedAfterClick !== toAbsoluteUrl(currentUrl, before.href)) {
    return resolvedAfterClick;
  }

  if (afterClick.selectedValue && afterClick.selectedValue !== before.selectedValue) {
    return toAbsoluteUrl(currentUrl, `#p=${afterClick.selectedValue}`);
  }

  if (afterClick.pageIndicator && afterClick.pageIndicator !== before.pageIndicator) {
    return toAbsoluteUrl(currentUrl, `#p=${afterClick.pageIndicator}`);
  }

  const selectedViaDropdown = await page.evaluate(() => {
    const select = document.querySelector('#pageSelect');
    if (!(select instanceof HTMLSelectElement)) {
      return '';
    }

    const nextIndex = select.selectedIndex + 1;
    if (nextIndex < 0 || nextIndex >= select.options.length) {
      return '';
    }

    const nextOption = select.options[nextIndex];
    if (!nextOption) {
      return '';
    }

    select.value = nextOption.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return nextOption.value.trim();
  });

  if (!selectedViaDropdown) {
    return null;
  }

  await page.waitForTimeout(500);
  const afterSelect = await getPageState();
  const resolvedAfterSelect = toAbsoluteUrl(currentUrl, afterSelect.href);
  if (resolvedAfterSelect && resolvedAfterSelect !== toAbsoluteUrl(currentUrl, before.href)) {
    return resolvedAfterSelect;
  }

  return toAbsoluteUrl(currentUrl, `#p=${selectedViaDropdown}`);
}



async function extractTotalPages(page: PlaywrightPageLike, rule: CrawlTotalPagesRule): Promise<number | null> {
  const rawValue = await page.evaluate(
    ({ selectorType, selector, attributeName }) => {
      let firstNode: Node | null = null;
      try {
        firstNode = selectorType === 'css'
          ? document.querySelector(selector)
          : document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch {
        return '';
      }

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
    jobId,
    startUrl,
    domain,
    contentRule,
    paginationRule,
    stopRules,
    timeoutMs = 30000,
    contentReadySelector,
    interactionSteps = [],
    metadataRules = [],
    totalPagesRule,
    onPageCrawled,
    abortSignal
  } = options;

  console.log('Starting crawl with options:', options);

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const errors: CrawlErrorRecord[] = [];
  const notes: string[] = [];
  const navigationWaitUntil = resolveNavigationWaitUntil(paginationRule.navigationMode);
  const postNavigationDelayMs = Math.max(0, Number(paginationRule.postNavigationDelaySeconds) || 0.5) * 1000;
  notes.push(
    `Pagination mode: ${paginationRule.navigationMode ?? 'url-attribute'}; page.goto waitUntil=${navigationWaitUntil}; post-navigation wait=${postNavigationDelayMs}ms.`
  );

  console.log('[crawl] start', {
    jobId,
    startUrl,
    domain,
    paginationMode: paginationRule.navigationMode ?? 'url-attribute',
    timeoutMs,
    stopRules
  });

  let currentUrl: string | null = startUrl;
  let totalPagesTarget: number | null = null;
  let consecutiveErrors = 0;
  let previousExtractedValue: string | null = null;
  let previousNavigatedUrl: string | null = null;

  const maxRetriesPerPage = Math.max(0, stopRules.maxRetriesPerPage ?? 1);
  const retryBackoffMs = Math.max(0, stopRules.retryBackoffMs ?? 750);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    while (currentUrl) {
      throwIfAborted(abortSignal);
      console.log(`[crawl] loop start currentUrl=${currentUrl} pages=${pages.length}`);
      if (visited.has(currentUrl)) {
        console.log(`[crawl] already-visited-url ${currentUrl}`);
        return { pagesProcessed: pages.length, stopReason: 'already-visited-url', pages, errors, notes };
      }

      if (pages.length >= Math.max(1, stopRules.maxPages)) {
        console.log(`[crawl] max-pages-reached ${pages.length} >= ${stopRules.maxPages}`);
        return { pagesProcessed: pages.length, stopReason: 'max-pages-reached', pages, errors, notes };
      }

      const host = normalizedHost(currentUrl);
      if (!host || host !== domain.replace(/^www\./, '').toLowerCase()) {
        console.log(`[crawl] out-of-domain-blocked host=${host} expected=${domain}`);
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

      let exhaustedRetries = false;

      try {
        for (let attempt = 1; attempt <= maxRetriesPerPage + 1; attempt += 1) {
          throwIfAborted(abortSignal);
          try {
            console.log(`[crawl] navigating to ${currentUrl} attempt=${attempt}`);
            await page.goto(currentUrl, { waitUntil: navigationWaitUntil, timeout: timeoutMs });

            if (paginationRule.navigationMode === 'url-pattern' && isHashOnlyNavigation(previousNavigatedUrl, currentUrl)) {
              await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
            }

            if (postNavigationDelayMs > 0) {
              await page.waitForTimeout(postNavigationDelayMs);
            }

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
              await page.waitForSelector(readySelector, { timeout: contentReadySelector.timeoutMs ?? timeoutMs, state: 'attached' });
            }

            visited.add(currentUrl);
            previousNavigatedUrl = currentUrl;
            console.log(`[crawl] navigation succeeded and marked visited ${currentUrl}`);
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown crawl attempt error';
            errors.push({ url: currentUrl, attempt, error: message });
            console.log(`[crawl] navigation attempt error url=${currentUrl} attempt=${attempt} error=${message}`);

            if (attempt > maxRetriesPerPage) {
              exhaustedRetries = true;
              throw error;
            }

            if (retryBackoffMs > 0) {
              await page.waitForTimeout(retryBackoffMs * attempt);
            }
          }
        }

        let extractedValue = await extractRuleValue(page, contentRule);

        const previousPageUrl = pages.at(-1)?.url;
        const sameDocumentHashNavigation = isHashOnlyNavigation(previousPageUrl ?? null, currentUrl);

        if (
          sameDocumentHashNavigation
          && previousExtractedValue
          && extractedValue === previousExtractedValue
        ) {
          extractedValue = await waitForDifferentRuleValue({
            page,
            rule: contentRule,
            previousValue: previousExtractedValue,
            timeoutMs
          });
        }

        console.log(`[crawl] extracted raw value length=${extractedValue ? String(extractedValue).length : 0}`);
        const content = await resolveContentValue({
          page,
          baseUrl: currentUrl,
          contentRule,
          extractedValue,
          timeoutMs
        });

        console.log(`[crawl] resolved content length=${content ? content.length : 0}`);

        const metadata: Record<string, string> = {};
        for (const rule of metadataRules) {
          const metadataKey = resolveMetadataKey(rule);
          if (!metadataKey) {
            continue;
          }

          const extractedMetadata = await extractRuleValue(page, rule);

          const resolvedMetadataValue = await resolveContentValue({
            page,
            baseUrl: currentUrl,
            contentRule: rule,
            extractedValue: extractedMetadata,
            timeoutMs
          });

          console.log(`[crawl] metadata ${metadataKey} length=${resolvedMetadataValue ? resolvedMetadataValue.length : 0}`);
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

        onPageCrawled?.({
          pagesProcessed: pages.length,
          totalPages: totalPagesTarget ?? undefined,
          currentUrl
        });

        console.log(`[crawl] page saved url=${currentUrl} stylesheets=${domAssets.stylesheets.length}+${networkStylesheets.size} scripts=${domAssets.scripts.length}+${networkScripts.size}`);
        previousExtractedValue = extractedValue;

        consecutiveErrors = 0;

        if (totalPagesRule && totalPagesTarget === null) {
          const extractedTotalPages = await extractTotalPages(page, totalPagesRule);
          if (extractedTotalPages !== null) {
            totalPagesTarget = extractedTotalPages;
            notes.push(`Total pages target extracted: ${extractedTotalPages}.`);
            onPageCrawled?.({ pagesProcessed: pages.length, totalPages: totalPagesTarget, currentUrl });
            console.log(`[crawl] total pages target extracted=${extractedTotalPages}`);
          }
        }

        if (totalPagesTarget !== null && pages.length >= totalPagesTarget) {
          notes.push(`Reached extracted total pages target (${totalPagesTarget}).`);
          console.log(`[crawl] reached total-pages-target ${totalPagesTarget}`);
          return { pagesProcessed: pages.length, stopReason: 'total-pages-reached', pages, errors, notes };
        }

        const resolvedNext = await resolveNextUrl({
          page,
          currentUrl,
          paginationRule,
          timeoutMs
        });
        console.log(`[crawl] resolved next url from ${currentUrl} => ${resolvedNext}`);
        if (!resolvedNext) {
          console.log(`[crawl] no-next-button at ${currentUrl}`);
          return { pagesProcessed: pages.length, stopReason: 'no-next-button', pages, errors, notes };
        }

        currentUrl = resolvedNext;
      } catch (error) {
        if (error instanceof CrawlCancelledError) {
          notes.push('Crawl cancelled by user request.');
          return { pagesProcessed: pages.length, stopReason: 'cancelled', pages, errors, notes };
        }
        consecutiveErrors += 1;
        const message = error instanceof Error ? error.message : 'Unknown crawl processing error';

        console.log(`[crawl] processing error url=${currentUrl} message=${message} exhaustedRetries=${exhaustedRetries}`);
        if (!exhaustedRetries) {
          errors.push({ url: currentUrl, attempt: maxRetriesPerPage + 1, error: message });
        }

        if (consecutiveErrors >= Math.max(1, stopRules.maxConsecutiveErrors)) {
          console.log(`[crawl] error-threshold-reached consecutiveErrors=${consecutiveErrors}`);
          return { pagesProcessed: pages.length, stopReason: 'error-threshold-reached', pages, errors, notes };
        }
      } finally {
        page.off('requestfinished', requestHandler);
      }
    }

    console.log('[crawl] finished main loop, returning no-next-button');
    return { pagesProcessed: pages.length, stopReason: 'no-next-button', pages, errors, notes };
  } finally {
    console.log('[crawl] closing browser context and browser');
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
