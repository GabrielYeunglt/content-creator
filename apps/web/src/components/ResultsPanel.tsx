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
      <p>Recorded jobs with single-page fetch/extraction results.</p>

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
        </article>
      ))}
    </section>
  );
}
