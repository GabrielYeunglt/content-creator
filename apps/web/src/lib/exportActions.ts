import { buildCanonicalDocument } from '../../../../packages/core/src';
import { renderCanonicalHtml } from '../../../../packages/export-engine/src';
import { readSavedExportFormatConfig } from './exportFormatStorage';
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

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'artifact';
}

function buildExportBaseName(job: JobRecord): string {
  const template = job.exportFileNameTemplate?.trim() || '{{job.id}}-{{date}}';
  const now = new Date().toISOString().replaceAll(':', '-');
  const metadata = job.consolidatedDocument?.metadata ?? {};
  const documentTitle = job.consolidatedDocument?.title ?? job.profileName;

  const rendered = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, tokenRaw: string) => {
    const token = tokenRaw.trim();
    if (token === 'job.id') return job.id;
    if (token === 'date') return now;
    if (token === 'profile.name') return job.profileName;
    if (token === 'profile.domain') return job.profileDomain;
    if (token === 'document.title') return documentTitle;
    if (token.startsWith('metadata.')) {
      return metadata[token.slice('metadata.'.length)] ?? '';
    }
    return '';
  });

  return sanitizeFilePart(rendered) || `${sanitizeFilePart(job.id)}-${now}`;
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

  const savedExportLayout = readSavedExportFormatConfig();

  const response = await bridge({
    jobId: job.id,
    format,
    pages: job.extractedPages ?? [],
    profileName: job.profileName,
    profileDomain: job.profileDomain,
    crawlPagesTempFileId: job.crawlPagesTempFileId,
    exportDestination: job.exportDestination,
    exportFileNameTemplate: job.exportFileNameTemplate,
    exportLayout: savedExportLayout ?? undefined
  });

  return persistArtifacts(job, response.artifacts);
}

export async function exportJobAsHtml(job: JobRecord): Promise<JobRecord[] | null> {
  if (job.exportDestination === 'browser-download') {
    const canonical = canonicalFromJob(job);
    const html = renderCanonicalHtml(canonical, readSavedExportFormatConfig() ?? undefined);
    downloadTextFile(`${buildExportBaseName(job)}.html`, html, 'text/html;charset=utf-8');
    return null;
  }

  const desktopExport = await runDesktopExport(job, 'html');
  if (desktopExport) {
    return desktopExport;
  }

  const canonical = canonicalFromJob(job);
  const html = renderCanonicalHtml(canonical, readSavedExportFormatConfig() ?? undefined);
  downloadTextFile(`${buildExportBaseName(job)}.html`, html, 'text/html;charset=utf-8');
  return null;
}

export async function exportJobAsEpub(job: JobRecord): Promise<JobRecord[] | null> {
  if (job.exportDestination === 'browser-download') {
    return updateJob(job.id, {
      note: 'Current export destination is browser download. EPUB requires desktop export destination.'
    });
  }

  const desktopExport = await runDesktopExport(job, 'epub');
  if (desktopExport) {
    return desktopExport;
  }

  return updateJob(job.id, {
    note: 'EPUB export requires the desktop/backend export bridge runtime.'
  });
}

export async function exportJobAllViaDesktop(job: JobRecord): Promise<JobRecord[] | null> {
  if (job.exportDestination === 'browser-download') {
    return updateJob(job.id, {
      note: 'Current export destination is browser download. Export all requires desktop export destination.'
    });
  }

  return runDesktopExport(job, 'all');
}
