import { buildCanonicalDocument } from '../../../../packages/core/src';
import { renderCanonicalHtml, renderEpubLikeManifest } from '../../../../packages/export-engine/src';
import type { JobRecord } from '../types/job';

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function canonicalFromJob(job: JobRecord) {
  return buildCanonicalDocument({
    jobId: job.id,
    profileName: job.profileName,
    profileDomain: job.profileDomain,
    pages: job.extractedPages ?? []
  });
}

export function exportJobAsHtml(job: JobRecord): void {
  const canonical = canonicalFromJob(job);
  const html = renderCanonicalHtml(canonical);
  downloadTextFile(`${job.id}.html`, html, 'text/html;charset=utf-8');
}

export function exportJobAsEpubManifest(job: JobRecord): void {
  const canonical = canonicalFromJob(job);
  const manifest = renderEpubLikeManifest(canonical);
  downloadTextFile(`${job.id}.epub-manifest.json`, manifest, 'application/json;charset=utf-8');
}
