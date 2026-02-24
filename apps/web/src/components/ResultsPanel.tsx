import { exportJobAllViaDesktop, exportJobAsEpub, exportJobAsHtml } from '../lib/exportActions';
import type { JobRecord, JobStatus } from '../types/job';

type ResultsPanelProps = {
  jobs: JobRecord[];
  onJobsUpdated: (jobs: JobRecord[]) => void;
};


function stopReasonHelp(stopReason: string | undefined): string | null {
  if (!stopReason) {
    return null;
  }

  if (stopReason === 'desktop-crawler-bridge-missing') {
    return 'Crawler bridge is not connected. Run desktop/backend runtime and expose __CONTENT_CREATOR_DESKTOP_CRAWLER__.';
  }

  if (stopReason === 'virtual-browser-crawl-error') {
    return 'Desktop crawl failed. Check backend logs, target URL reachability, and selector configuration.';
  }

  if (stopReason === 'out-of-domain-blocked') {
    return 'Next URL left the configured domain. Update profile domain or pagination selector if needed.';
  }

  if (stopReason === 'desktop-export-bridge-missing') {
    return 'Selected job profile export destination is desktop, but export bridge is unavailable.';
  }

  return null;
}

function statusColor(status: JobStatus): string {
  if (status === 'queued') {
    return '#8a4f00';
  }
  if (status === 'running') {
    return '#0b57d0';
  }
  if (status === 'completed') {
    return '#1f7a1f';
  }
  return '#b00020';
}

export function ResultsPanel({ jobs, onJobsUpdated }: ResultsPanelProps) {
  async function handleExportHtml(job: JobRecord) {
    const updated = await exportJobAsHtml(job);
    if (updated) {
      onJobsUpdated(updated);
    }
  }

  async function handleExportEpub(job: JobRecord) {
    const updated = await exportJobAsEpub(job);
    if (updated) {
      onJobsUpdated(updated);
    }
  }

  async function handleExportAll(job: JobRecord) {
    const updated = await exportJobAllViaDesktop(job);
    if (updated) {
      onJobsUpdated(updated);
    }
  }

  return (
    <section>
      <h2>Results</h2>
      <p>Recorded jobs with crawl-loop execution results.</p>

      {jobs.length === 0 && <p>No jobs recorded yet.</p>}

      {jobs.map((job) => (
        <article key={job.id} style={{ border: '1px solid #ddd', padding: '0.75rem', marginBottom: '0.75rem' }}>
          <p>
            <strong>{job.profileName}</strong> ({job.profileDomain})
          </p>
          <p>
            URL: <code>{job.startUrl}</code>
          </p>
          <p>
            Status: <strong style={{ color: statusColor(job.status) }}>{job.status}</strong>
          </p>
          <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
          {job.completedAt && <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>}
          {job.note && <p>Note: {job.note}</p>}

          {typeof job.pagesProcessed === 'number' && <p>Pages processed: {job.pagesProcessed}</p>}
          {job.lastVisitedUrl && (
            <p>
              Last visited URL: <code>{job.lastVisitedUrl}</code>
            </p>
          )}
          {job.stopReason && <p>Stop reason: {job.stopReason}</p>}
          {stopReasonHelp(job.stopReason) && (
            <p style={{ color: '#8a4f00' }}>Guidance: {stopReasonHelp(job.stopReason)}</p>
          )}
          {job.consolidatedDocument && (
            <div>
              <p>
                Consolidated document: <strong>{job.consolidatedDocument.title}</strong> (
                {job.consolidatedDocument.chapterCount} chapter(s))
              </p>
              {job.consolidatedDocument.metadata && Object.keys(job.consolidatedDocument.metadata).length > 0 && (
                <details>
                  <summary>Book metadata</summary>
                  <ul>
                    {Object.entries(job.consolidatedDocument.metadata).map(([key, value]) => (
                      <li key={`${job.id}-meta-${key}`}>
                        <strong>{key}</strong>: {value}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {job.error && <p style={{ color: '#b00020' }}>Error: {job.error}</p>}
          {job.extractedPreview && (
            <p>
              Extracted preview: <code>{job.extractedPreview}</code>
            </p>
          )}
          {job.nextUrl && (
            <p>
              Next URL: <code>{job.nextUrl}</code>
            </p>
          )}

          {job.extractedPages && job.extractedPages.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void handleExportHtml(job)}>
                Export HTML snapshot
              </button>
              <button type="button" onClick={() => void handleExportEpub(job)}>
                Export EPUB
              </button>
              <button type="button" onClick={() => void handleExportAll(job)}>
                Export all (desktop bridge)
              </button>
            </div>
          )}

          {job.exportedArtifacts && job.exportedArtifacts.length > 0 && (
            <details>
              <summary>Exported artifacts ({job.exportedArtifacts.length})</summary>
              <ul>
                {job.exportedArtifacts.map((artifact, index) => (
                  <li key={`${job.id}-artifact-${index}`}>
                    <code>{artifact.format}</code> → <code>{artifact.path}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {job.logs && job.logs.length > 0 && (
            <details>
              <summary>Job log ({job.logs.length})</summary>
              <ul>
                {job.logs.map((entry, index) => (
                  <li key={`${job.id}-log-${index}`}>
                    [{new Date(entry.at).toLocaleString()}] <strong>{entry.level.toUpperCase()}</strong> {entry.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {job.extractedPages && job.extractedPages.length > 0 && (
            <details>
              <summary>Extracted pages ({job.extractedPages.length})</summary>
              <ul>
                {job.extractedPages.map((page, index) => (
                  <li key={`${job.id}-${index}`}>
                    <code>{page.url}</code>
                    <div>{page.preview}</div>
                    <div style={{ fontSize: '0.9rem', color: '#444' }}>
                      Assets: {page.stylesheets?.length ?? 0} stylesheet(s), {page.scripts?.length ?? 0} script(s)
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>
      ))}
    </section>
  );
}
