import { buildCanonicalDocument } from '../../../../packages/core/src';
import { appendJobLog, updateJob, updateJobStatus } from './jobStorage';
import type { ExtractedPageRecord, JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';

type RunnerOptions = {
  onJobsUpdated: (jobs: JobRecord[]) => void;
  profile: WebsiteProfile;
  startUrl: string;
};

type VirtualBrowserCrawlRequest = {
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
    fieldType: 'title' | 'author' | 'chapter' | 'publisher' | 'series' | 'cover' | 'language' | 'description' | 'other';
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
    navigationMode?: 'url-attribute' | 'click';
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

function cleanPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 280 ? `${normalized.slice(0, 280)}…` : normalized;
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^www\./, '').toLowerCase();
}

function getDesktopCrawlerBridge():
  | ((request: VirtualBrowserCrawlRequest) => Promise<VirtualBrowserCrawlResponse>)
  | null {
  const bridge = (window as Window & {
    __CONTENT_CREATOR_DESKTOP_CRAWLER__?: (request: VirtualBrowserCrawlRequest) => Promise<VirtualBrowserCrawlResponse>;
  }).__CONTENT_CREATOR_DESKTOP_CRAWLER__;

  return typeof bridge === 'function' ? bridge : null;
}

export async function runCrawlJob(jobId: string, options: RunnerOptions): Promise<void> {
  const { onJobsUpdated, profile, startUrl } = options;

  const primaryRule = profile.selectorRules[0];
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
  onJobsUpdated(appendJobLog(jobId, { level: 'info', message: `Job started for ${startUrl}` }));

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
    const result = await bridge({
      startUrl,
      domain: normalizeDomain(profile.domain),
      contentRule: {
        selectorType: primaryRule.selectorType,
        selector: primaryRule.selector,
        extractMode: primaryRule.extractMode,
        attributeName: primaryRule.attributeName,
        attributeUrlMode: primaryRule.attributeUrlMode
      },
      metadataRules: (profile.metadataRules ?? []).map((rule) => ({
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
        selector: profile.paginationRule.selector,
        attributeName: profile.paginationRule.attributeName,
        navigationMode: profile.paginationRule.navigationMode
      },
      totalPagesRule: profile.totalPagesRule
        ? {
          selectorType: profile.totalPagesRule.selectorType,
          selector: profile.totalPagesRule.selector,
          attributeName: profile.totalPagesRule.attributeName
        }
        : undefined,
      stopRules: {
        maxPages: Math.max(1, profile.stopRules.maxPages),
        maxConsecutiveErrors: 3
      },
      contentReadySelector: {
        selectorType: primaryRule.selectorType,
        selector: primaryRule.selector,
        timeoutMs: 15000
      }
    });

    const extractedPages: ExtractedPageRecord[] = result.pages.map((item) => ({
      url: item.url,
      content: item.content,
      preview: cleanPreview(item.content),
      metadata: item.metadata,
      stylesheets: item.stylesheets,
      scripts: item.scripts
    }));

    const consolidated = buildCanonicalDocument({
      jobId,
      profileName: profile.name,
      profileDomain: profile.domain,
      pages: extractedPages
    });

    const completed = updateJob(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      pagesProcessed: result.pagesProcessed,
      lastVisitedUrl: result.pages[result.pages.length - 1]?.url,
      extractedPages,
      extractedPreview: extractedPages.map((item, index) => `Page ${index + 1}: ${item.preview}`).join('\n\n'),
      consolidatedDocument: {
        id: consolidated.id,
        title: consolidated.title,
        sourceDomain: consolidated.sourceDomain,
        generatedAt: consolidated.generatedAt,
        chapterCount: consolidated.chapters.length
        ,metadata: consolidated.metadata
      },
      stopReason: result.stopReason,
      note: `Virtual-browser crawl completed with stop reason: ${result.stopReason}.`
    });

    onJobsUpdated(completed);
    onJobsUpdated(
      appendJobLog(jobId, {
        level: 'info',
        message: `Crawl completed: ${result.pagesProcessed} page(s), stop reason ${result.stopReason}.`
      })
    );

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
