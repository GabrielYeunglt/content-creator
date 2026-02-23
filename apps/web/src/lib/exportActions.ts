import { buildCanonicalDocument } from '../../../../packages/core/src';
import { renderCanonicalHtml } from '../../../../packages/export-engine/src';
import { updateJob } from './jobStorage';
import type { ExportedArtifactRecord, JobRecord } from '../types/job';

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

function getDesktopExportBridge() {
  const bridge = (window as Window).__CONTENT_CREATOR_DESKTOP_EXPORT__;
  return typeof bridge === 'function' ? bridge : null;
}

function persistArtifacts(job: JobRecord, artifacts: Array<{ format: ExportedArtifactRecord['format']; path: string }>): JobRecord[] {
  const now = new Date().toISOString();
  const records: ExportedArtifactRecord[] = artifacts.map((artifact) => ({
    ...artifact,
    createdAt: now
  }));

  return updateJob(job.id, {
    exportedArtifacts: [...(job.exportedArtifacts ?? []), ...records],
    note: `Export completed (${records.map((item) => item.format).join(', ')}).`
  });
}

async function runDesktopExport(job: JobRecord, format: 'html' | 'pdf' | 'epub' | 'all'): Promise<JobRecord[] | null> {
  const bridge = getDesktopExportBridge();
  if (!bridge) {
    return null;
  }

  const response = await bridge({
    jobId: job.id,
    format,
    pages: job.extractedPages ?? [],
    profileName: job.profileName,
    profileDomain: job.profileDomain
  });

  return persistArtifacts(job, response.artifacts);
}

export async function exportJobAsHtml(job: JobRecord): Promise<JobRecord[] | null> {
  const desktopExport = await runDesktopExport(job, 'html');
  if (desktopExport) {
    return desktopExport;
  }

  const canonical = canonicalFromJob(job);
  const html = renderCanonicalHtml(canonical);
  downloadTextFile(`${job.id}.html`, html, 'text/html;charset=utf-8');
  return null;
}

export async function exportJobAsEpub(job: JobRecord): Promise<JobRecord[] | null> {
  const desktopExport = await runDesktopExport(job, 'epub');
  if (desktopExport) {
    return desktopExport;
  }

  return updateJob(job.id, {
    note: 'EPUB export requires the desktop/backend export bridge runtime.'
  });
}

export async function exportJobAllViaDesktop(job: JobRecord): Promise<JobRecord[] | null> {
  return runDesktopExport(job, 'all');
}
