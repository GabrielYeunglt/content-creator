import type { JobRecord } from '../types/job';

export type JobProgressInfo = {
  label: string;
  detail: string;
  percent: number;
};

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function estimateExportTotalSteps(job: JobRecord): number {
  const pageCount = Math.max(1, job.extractedPages?.length ?? job.pagesProcessed ?? 1);
  const imageSteps = Math.max(1, Math.ceil(pageCount * 0.35));
  return pageCount + imageSteps + 2;
}

function detectCrawlTotalPages(job: JobRecord): number | null {
  if (job.note) {
    const match = job.note.match(/(?:total\s*pages?|pages\s*total)\D{0,5}(\d{1,5})/i);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

export function getJobProgressInfo(job: JobRecord, activeAction: 'crawl' | 'export' = 'crawl'): JobProgressInfo {
  const processed = Math.max(0, job.pagesProcessed ?? 0);
  if (activeAction === 'export') {
    if ((job.extractedPages?.length ?? 0) === 0) {
      return { label: 'Export', detail: 'Waiting for extracted pages', percent: 0 };
    }

    if (job.status === 'failed') {
      return { label: 'Export failed', detail: job.note ?? 'Export failed', percent: 100 };
    }

    return { label: 'Exporting', detail: 'Preparing export artifacts', percent: 35 };
  }

  const crawlTotal = detectCrawlTotalPages(job);

  if (job.status === 'queued') {
    return { label: 'Queued', detail: 'Waiting to start', percent: 0 };
  }

  if (job.status === 'running') {
    if (crawlTotal && crawlTotal > 0) {
      return {
        label: 'Crawling',
        detail: `${processed}/${crawlTotal} pages`,
        percent: clampPercent((processed / crawlTotal) * 100)
      };
    }

    return {
      label: 'Crawling',
      detail: `${processed} pages processed`,
      percent: clampPercent(Math.min(90, processed * 8))
    };
  }

  const hasExportArtifacts = (job.exportedArtifacts?.length ?? 0) > 0;
  if (job.status === 'completed' && hasExportArtifacts) {
    const totalSteps = estimateExportTotalSteps(job);
    return {
      label: 'Exported',
      detail: `${totalSteps}/${totalSteps} estimated export steps`,
      percent: 100
    };
  }

  if (job.status === 'completed') {
    const crawlDetail = crawlTotal ? `${processed}/${crawlTotal} pages` : `${processed} pages`;
    return { label: 'Crawl complete', detail: crawlDetail, percent: 100 };
  }

  return {
    label: 'Failed',
    detail: processed > 0 ? `${processed} pages before failure` : 'Stopped before processing pages',
    percent: clampPercent(Math.min(100, processed * 5))
  };
}
