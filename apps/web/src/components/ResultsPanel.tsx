import type { JobRecord, JobStatus } from '../types/job';

type ResultsPanelProps = {
  jobs: JobRecord[];
};

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

export function ResultsPanel({ jobs }: ResultsPanelProps) {
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
