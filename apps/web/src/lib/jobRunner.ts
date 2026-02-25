import { buildCanonicalDocument } from '../../../../packages/core/src';
import { appendJobLog, updateJob, updateJobStatus } from './jobStorage';
import type { JobMode, JobProfile } from '../types/jobProfile';
import type { ExtractedPageRecord, JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';

type RunnerOptions = {
  onJobsUpdated: (jobs: JobRecord[]) => void;
  profile: WebsiteProfile;
  startUrl: string;
  startUrls?: string[];
  mode?: JobMode;
  jobProfile?: JobProfile;
};

type VirtualBrowserCrawlRequest = {
  jobId?: string;
  onPageCrawled?: (payload: {
    pagesProcessed: number;
    totalPages?: number;
    currentUrl?: string;
  }) => void;

  startUrl: string;
  domain: string;
  contentRule: {
    selectorType: 'css' | 'xpath';
    selector: string;
    extractMode: 'text' | 'html' | 'attribute';
    attributeName?: string;
    attributeUrlMode?: 'value' | 'fetch-image-data-url';
  };
  metadataRules?: Array<{
    fieldType: 'title' | 'author' | 'volume' | 'chapter' | 'publisher' | 'series' | 'subject' | 'cover' | 'language' | 'description' | 'other';
    customFieldName?: string;
    selectorType: 'css' | 'xpath';
    selector: string;
    extractMode: 'text' | 'html' | 'attribute';
    attributeName?: string;
    attributeUrlMode?: 'value' | 'fetch-image-data-url';
  }>;
  paginationRule: {
    selectorType: 'css' | 'xpath';
    selector: string;
    attributeName: string;
    navigationMode?: 'url-attribute' | 'click' | 'url-pattern';
    postNavigationDelaySeconds?: number;
  };
  totalPagesRule?: {
    selectorType: 'css' | 'xpath';
    selector: string;
    attributeName?: string;
  };
  stopRules: {
    maxPages: number;
    maxConsecutiveErrors: number;
  };
  contentReadySelector?: {
    selectorType: 'css' | 'xpath';
    selector: string;
    timeoutMs?: number;
  };
};

type VirtualBrowserCrawlResponse = {
  pagesProcessed: number;
  stopReason: string;
  crawlPagesTempFileId?: string;
  errors?: Array<{ url: string; attempt: number; error: string }>;
  notes?: string[];
  pages: Array<{
    url: string;
    content: string;
    metadata?: Record<string, string>;
    stylesheets: string[];
    scripts: string[];
  }>;
};

function createStoredContent(content: string, crawlPagesTempFileId?: string): string {
  if (crawlPagesTempFileId) {
    return '';
  }

  return content;
}

function cleanPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 280 ? `${normalized.slice(0, 280)}…` : normalized;
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^www\./, '').toLowerCase();
}

function metadataAliasKeys(key: string): string[] {
  const normalized = key.trim().toLowerCase();
  if (normalized === 'chapter' || normalized === 'volume') {
    return ['chapter', 'volume'];
  }

  return [normalized];
}

function getMetadataValue(metadata: Record<string, string> | undefined, key: string): string {
  if (!metadata) {
    return '';
  }

  for (const alias of metadataAliasKeys(key)) {
    const value = Object.entries(metadata).find(([metadataKey]) => metadataKey.toLowerCase() === alias)?.[1];
    if (value) {
      return value;
    }
  }

  return '';
}

function resolveMetadataTemplate(template: string, metadata: Record<string, string> | undefined): string {
  return template.replace(/\{\{\s*metadata\.([^\s{}]+)\s*\}\}/g, (_match, rawKey: string) => {
    if (!metadata) {
      return '';
    }

    const key = rawKey.trim().toLowerCase();
    return getMetadataValue(metadata, key);
  });
}

function resolveMetadataOverrides(
  overrides: JobProfile['metadataOverrides'] | undefined,
  metadata: Record<string, string> | undefined
): Record<string, string> {
  if (!overrides) {
    return {};
  }

  const resolvedEntries = Object.entries(overrides).map(([key, value]) => {
    const template = value?.trim() ?? '';
    if (!template) {
      return [key, ''];
    }

    return [key, resolveMetadataTemplate(template, metadata).trim()];
  });

  return Object.fromEntries(resolvedEntries);
}

function getDesktopCrawlerBridge():
  | ((request: VirtualBrowserCrawlRequest) => Promise<VirtualBrowserCrawlResponse>)
  | null {
  const bridge = (window as Window & {
    __CONTENT_CREATOR_DESKTOP_CRAWLER__?: (request: VirtualBrowserCrawlRequest) => Promise<VirtualBrowserCrawlResponse>;
  }).__CONTENT_CREATOR_DESKTOP_CRAWLER__;

  return typeof bridge === 'function' ? bridge : null;
}

function getDesktopExportBridge(): ((request: unknown) => Promise<unknown>) | null {
  const bridge = (window as Window & {
    __CONTENT_CREATOR_DESKTOP_EXPORT__?: (request: unknown) => Promise<unknown>;
  }).__CONTENT_CREATOR_DESKTOP_EXPORT__;

  return typeof bridge === 'function' ? bridge : null;
}

export async function runCrawlJob(jobId: string, options: RunnerOptions): Promise<void> {
  const { onJobsUpdated, profile, startUrl, startUrls, jobProfile } = options;

  const primaryRule = profile.selectorRules[0];

  if (jobProfile?.exportDestination !== 'browser-download' && !getDesktopExportBridge()) {
    const failed = updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stopReason: 'desktop-export-bridge-missing',
      note: 'Selected export destination requires desktop export bridge, but it is not connected.'
    });
    onJobsUpdated(failed);
    return;
  }

  if (!primaryRule) {
    const failed = updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stopReason: 'missing-selector-rule',
      error: 'No selector rule configured in selected profile.',
      note: 'Profile is missing a primary selector rule.'
    });
    onJobsUpdated(failed);
    return;
  }

  const running = updateJobStatus(jobId, 'running', 'Running virtual-browser crawl...');
  onJobsUpdated(running);
  const urlsToRun = (startUrls?.length ? startUrls : [startUrl]).map((url) => url.trim()).filter(Boolean);
  onJobsUpdated(
    appendJobLog(
      jobId,
      {
        level: 'info',
        message: `Job started for ${urlsToRun.length} URL(s): ${urlsToRun.join(', ')}`
      }
    )
  );

  const bridge = getDesktopCrawlerBridge();
  if (!bridge) {
    const failed = updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stopReason: 'desktop-crawler-bridge-missing',
      note:
        'Virtual-browser crawl in this web app path expects a desktop/backend crawler bridge. If your environment injects that bridge, crawl can run; otherwise this standalone app fails fast.'
    });
    onJobsUpdated(failed);
    onJobsUpdated(appendJobLog(jobId, { level: 'error', message: 'Desktop crawler bridge missing.' }));
    return;
  }

  try {
    const maxPages = Math.max(1, jobProfile?.maxPagesOverride ?? profile.stopRules.maxPages);
    const activeMetadataRules = (profile.metadataRules ?? []).filter((rule) => {
      const overrideValue = Object.entries(jobProfile?.metadataOverrides ?? {}).find(([key]) => (
        metadataAliasKeys(key).includes(rule.fieldType.toLowerCase())
        || metadataAliasKeys(rule.fieldType).includes(key.toLowerCase())
      ))?.[1];
      return !(overrideValue?.trim());
    });
    const responses = await Promise.all(urlsToRun.map(async (url) => bridge({
      jobId,
      startUrl: url,
      domain: normalizeDomain(profile.domain),
      contentRule: {
        selectorType: primaryRule.selectorType,
        selector: jobProfile?.contentSelectorOverride ?? primaryRule.selector,
        extractMode: primaryRule.extractMode,
        attributeName: primaryRule.attributeName,
        attributeUrlMode: primaryRule.attributeUrlMode
      },
      metadataRules: activeMetadataRules.map((rule) => ({
        fieldType: rule.fieldType,
        customFieldName: rule.customFieldName,
        selectorType: rule.selectorType,
        selector: rule.selector,
        extractMode: rule.extractMode,
        attributeName: rule.attributeName,
        attributeUrlMode: rule.attributeUrlMode
      })),
      paginationRule: {
        selectorType: profile.paginationRule.selectorType,
        selector: jobProfile?.paginationSelectorOverride ?? profile.paginationRule.selector,
        attributeName: profile.paginationRule.attributeName,
        navigationMode: profile.paginationRule.navigationMode,
        postNavigationDelaySeconds: profile.paginationRule.postNavigationDelaySeconds
      },
      totalPagesRule: profile.totalPagesRule
        ? {
          selectorType: profile.totalPagesRule.selectorType,
          selector: jobProfile?.totalPagesSelectorOverride ?? profile.totalPagesRule.selector,
          attributeName: profile.totalPagesRule.attributeName
        }
        : undefined,
      stopRules: {
        maxPages,
        maxConsecutiveErrors: 3
      },
      contentReadySelector: {
        selectorType: primaryRule.selectorType,
        selector: jobProfile?.contentSelectorOverride ?? primaryRule.selector,
        timeoutMs: 15000
      },
      onPageCrawled: ({ pagesProcessed, totalPages, currentUrl }) => {
        const detail = totalPages ? `${pagesProcessed}/${totalPages} pages crawled` : `${pagesProcessed} pages crawled`;
        onJobsUpdated(updateJob(jobId, {
          pagesProcessed,
          lastVisitedUrl: currentUrl,
          note: `Crawling in progress: ${detail}.`
        }));
      }
    })));

    const shouldUseCrawlPagesTempFile = responses.length === 1;

    const extractedPages: ExtractedPageRecord[] = responses.flatMap((result) => result.pages.map((item) => ({
      url: item.url,
      content: createStoredContent(item.content, shouldUseCrawlPagesTempFile ? result.crawlPagesTempFileId : undefined),
      preview: cleanPreview(item.content),
      metadata: {
        ...item.metadata,
        ...resolveMetadataOverrides(jobProfile?.metadataOverrides, item.metadata)
      },
      stylesheets: item.stylesheets,
      scripts: item.scripts
    })));

    const allPagesProcessed = responses.reduce((sum, response) => sum + response.pagesProcessed, 0);
    const lastResult = responses[responses.length - 1];
    const isCancelled = responses.some((result) => result.stopReason === 'cancelled');

    console.log('Crawl result:', responses.map((result) => ({
      stopReason: result.stopReason,
      pages: result.pages.map((p) => ({ url: p.url, metadata: p.metadata }))
    })));

    const consolidated = buildCanonicalDocument({
      jobId,
      profileName: profile.name,
      profileDomain: profile.domain,
      pages: extractedPages
    });

    const completed = updateJob(jobId, {
      status: isCancelled ? 'cancelled' : 'completed',
      completedAt: new Date().toISOString(),
      pagesProcessed: allPagesProcessed,
      lastVisitedUrl: extractedPages[extractedPages.length - 1]?.url,
      extractedPages,
      crawlPagesTempFileId: shouldUseCrawlPagesTempFile ? lastResult?.crawlPagesTempFileId : undefined,
      extractedPreview: extractedPages.map((item, index) => `Page ${index + 1}: ${item.preview}`).join('\n\n'),
      consolidatedDocument: {
        id: consolidated.id,
        title: consolidated.title,
        sourceDomain: consolidated.sourceDomain,
        generatedAt: consolidated.generatedAt,
        chapterCount: consolidated.chapters.length
        ,metadata: consolidated.metadata
      },
      stopReason: lastResult?.stopReason ?? 'completed',
      note: isCancelled
        ? 'Crawl stopped by user.'
        : `Virtual-browser crawl completed for ${urlsToRun.length} URL(s). Final stop reason: ${lastResult?.stopReason ?? 'completed'}.`
    });

    onJobsUpdated(completed);
    onJobsUpdated(
      appendJobLog(jobId, {
        level: 'info',
        message: `Crawl completed: ${allPagesProcessed} page(s) across ${urlsToRun.length} URL(s), final stop reason ${lastResult?.stopReason ?? 'completed'}.`
      })
    );

    for (const result of responses) {
      for (const note of result.notes ?? []) {
        onJobsUpdated(
          appendJobLog(jobId, {
            level: 'info',
            message: note
          })
        );
      }

      for (const issue of result.errors ?? []) {
        onJobsUpdated(
          appendJobLog(jobId, {
            level: 'warn',
            message: `Crawl retry/error at ${issue.url} (attempt ${issue.attempt}): ${issue.error}`
          })
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const failed = updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stopReason: 'virtual-browser-crawl-error',
      error: message,
      note: 'Desktop/backend virtual-browser crawl failed. Check bridge runtime logs.'
    });

    onJobsUpdated(failed);
    onJobsUpdated(appendJobLog(jobId, { level: 'error', message: `Crawl failed: ${message}` }));
  }
}
