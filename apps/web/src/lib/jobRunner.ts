import { updateJob, updateJobStatus } from './jobStorage';
import { extractFieldFromHtml, extractNextUrlFromHtml } from './selectorEval';
import type { JobRecord } from '../types/job';
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

export async function runSinglePageJob(jobId: string, options: RunnerOptions): Promise<void> {
  const { onJobsUpdated, profile, startUrl } = options;

  const running = updateJobStatus(jobId, 'running', 'Fetching and extracting single page...');
  onJobsUpdated(running);

  try {
    const html = await fetchHtml(startUrl, 15000);
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
        stopReason: 'content-selector-no-match',
        error: contentResult.error,
        note: 'Content extraction failed.'
      });
      onJobsUpdated(failed);
      return;
    }

    const nextResult = extractNextUrlFromHtml({
      html,
      selectorType: profile.paginationRule.selectorType,
      selector: profile.paginationRule.selector,
      attributeName: profile.paginationRule.attributeName
    });

    const completed = updateJob(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      extractedPreview: cleanPreview(contentResult.value),
      nextUrl: nextResult.ok ? nextResult.value : '',
      stopReason: nextResult.ok && nextResult.value ? 'single-page-complete-next-found' : 'single-page-complete-no-next',
      note: nextResult.ok
        ? 'Single-page extraction completed.'
        : 'Single-page extraction completed; next selector did not return a link.'
    });

    onJobsUpdated(completed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const looksLikeCorsFailure =
      message.toLowerCase().includes('failed to fetch') ||
      message.toLowerCase().includes('networkerror') ||
      message.toLowerCase().includes('load failed');

    const failed = updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stopReason: looksLikeCorsFailure ? 'browser-fetch-blocked' : 'network-or-parse-error',
      error: message,
      note: looksLikeCorsFailure
        ? 'Browser fetch was blocked (likely CORS). In desktop mode, move fetch/extract to backend runtime.'
        : 'Failed to fetch or process page.'
    });
    onJobsUpdated(failed);
  }
}
