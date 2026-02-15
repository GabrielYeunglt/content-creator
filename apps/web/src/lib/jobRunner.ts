import { updateJob, updateJobStatus } from './jobStorage';
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
  };
  paginationRule: {
    selectorType: 'css' | 'xpath';
    selector: string;
    attributeName: string;
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
  pages: Array<{
    url: string;
    content: string;
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

  const bridge = getDesktopCrawlerBridge();
  if (!bridge) {
    const failed = updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stopReason: 'desktop-crawler-bridge-missing',
      note:
        'Virtual-browser crawl requires desktop/backend bridge wiring. Running `apps/web` standalone cannot execute Playwright.'
    });
    onJobsUpdated(failed);
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
        attributeName: primaryRule.attributeName
      },
      paginationRule: {
        selectorType: profile.paginationRule.selectorType,
        selector: profile.paginationRule.selector,
        attributeName: profile.paginationRule.attributeName
      },
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
      preview: cleanPreview(item.content),
      stylesheets: item.stylesheets,
      scripts: item.scripts
    }));

    const completed = updateJob(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      pagesProcessed: result.pagesProcessed,
      lastVisitedUrl: result.pages[result.pages.length - 1]?.url,
      extractedPages,
      extractedPreview: extractedPages.map((item, index) => `Page ${index + 1}: ${item.preview}`).join('\n\n'),
      stopReason: result.stopReason,
      note: `Virtual-browser crawl completed with stop reason: ${result.stopReason}.`
    });

    onJobsUpdated(completed);
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
  }
}
