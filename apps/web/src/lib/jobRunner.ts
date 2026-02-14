import { updateJob, updateJobStatus } from './jobStorage';
import { extractFieldFromHtml, extractLinkedAssetsFromHtml, extractNextUrlFromHtml } from './selectorEval';
import type { ExtractedPageRecord, JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';

type RunnerOptions = {
  onJobsUpdated: (jobs: JobRecord[]) => void;
  profile: WebsiteProfile;
  startUrl: string;
};

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.text();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function cleanPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 280 ? `${normalized.slice(0, 280)}…` : normalized;
}

function normalizedHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function resolveNextUrl(currentUrl: string, nextValue: string): string | null {
  if (!nextValue.trim()) {
    return null;
  }

  try {
    return new URL(nextValue, currentUrl).toString();
  } catch {
    return null;
  }
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

  const running = updateJobStatus(jobId, 'running', 'Running crawl loop...');
  onJobsUpdated(running);

  const visited = new Set<string>();
  const previews: string[] = [];
  const extractedPages: ExtractedPageRecord[] = [];
  const maxPages = Math.max(1, profile.stopRules.maxPages);
  let currentUrl: string | null = startUrl;
  let pagesProcessed = 0;

  while (currentUrl) {
    if (visited.has(currentUrl)) {
      const completed = updateJob(jobId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        pagesProcessed,
        lastVisitedUrl: currentUrl,
        extractedPreview: previews.join('\n\n'),
        extractedPages,
        stopReason: 'already-visited-url',
        note: 'Stopped to avoid URL loop.'
      });
      onJobsUpdated(completed);
      return;
    }

    if (pagesProcessed >= maxPages) {
      const completed = updateJob(jobId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        pagesProcessed,
        lastVisitedUrl: currentUrl,
        extractedPreview: previews.join('\n\n'),
        extractedPages,
        stopReason: 'max-pages-reached',
        note: `Stopped at max pages (${maxPages}).`
      });
      onJobsUpdated(completed);
      return;
    }

    const currentHost = normalizedHost(currentUrl);
    if (!currentHost || currentHost !== profile.domain) {
      const completed = updateJob(jobId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        pagesProcessed,
        lastVisitedUrl: currentUrl,
        extractedPreview: previews.join('\n\n'),
        extractedPages,
        stopReason: 'out-of-domain-blocked',
        note: `Stopped due to strict domain policy (${profile.domain}).`
      });
      onJobsUpdated(completed);
      return;
    }

    try {
      const html = await fetchHtml(currentUrl, 15000);
      visited.add(currentUrl);

      const contentResult = extractFieldFromHtml({
        html,
        selectorType: primaryRule.selectorType,
        selector: primaryRule.selector,
        extractMode: primaryRule.extractMode,
        attributeName: primaryRule.attributeName
      });

      if (!contentResult.ok) {
        const failed = updateJob(jobId, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          pagesProcessed,
          lastVisitedUrl: currentUrl,
          stopReason: 'content-selector-no-match',
          error: contentResult.error,
          note: 'Content extraction failed.',
          extractedPages
        });
        onJobsUpdated(failed);
        return;
      }

      const pagePreview = cleanPreview(contentResult.value);
      const linkedAssets = extractLinkedAssetsFromHtml({ html, baseUrl: currentUrl });
      previews.push(`Page ${pagesProcessed + 1}: ${pagePreview}`);
      extractedPages.push({
        url: currentUrl,
        preview: pagePreview,
        stylesheets: linkedAssets.stylesheets,
        scripts: linkedAssets.scripts
      });
      pagesProcessed += 1;

      const nextResult = extractNextUrlFromHtml({
        html,
        selectorType: profile.paginationRule.selectorType,
        selector: profile.paginationRule.selector,
        attributeName: profile.paginationRule.attributeName
      });

      const resolvedNext: string | null = nextResult.ok ? resolveNextUrl(currentUrl, nextResult.value) : null;

      const progress = updateJob(jobId, {
        pagesProcessed,
        lastVisitedUrl: currentUrl,
        extractedPreview: previews.join('\n\n'),
        extractedPages,
        nextUrl: resolvedNext ?? '',
        note: `Processed ${pagesProcessed} page(s) (assets: ${linkedAssets.stylesheets.length} CSS, ${linkedAssets.scripts.length} JS on latest page)...`
      });
      onJobsUpdated(progress);

      if (!resolvedNext) {
        const completed = updateJob(jobId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          pagesProcessed,
          lastVisitedUrl: currentUrl,
          extractedPreview: previews.join('\n\n'),
          extractedPages,
          stopReason: 'no-next-button',
          note: 'Crawl completed: no next page found.'
        });
        onJobsUpdated(completed);
        return;
      }

      currentUrl = resolvedNext;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const looksLikeCorsFailure =
        message.toLowerCase().includes('failed to fetch') ||
        message.toLowerCase().includes('networkerror') ||
        message.toLowerCase().includes('load failed');

      const failed = updateJob(jobId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        pagesProcessed,
        lastVisitedUrl: currentUrl ?? undefined,
        stopReason: looksLikeCorsFailure ? 'browser-fetch-blocked' : 'network-or-parse-error',
        error: message,
        extractedPages,
        note: looksLikeCorsFailure
          ? 'Browser fetch was blocked (likely CORS). In desktop mode, move fetch/extract to backend runtime.'
          : 'Failed to fetch or process page.'
      });
      onJobsUpdated(failed);
      return;
    }
  }
}
