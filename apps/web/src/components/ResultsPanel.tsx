import { exportJobAllViaDesktop, exportJobAsEpub, exportJobAsHtml, exportJobAsPdf } from '../lib/exportActions';
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
  if (status === 'queued') return 'text-amber-700';
  if (status === 'running') return 'text-blue-700';
  if (status === 'completed') return 'text-green-700';
  return 'text-rose-700';
}

export function ResultsPanel({ jobs, onJobsUpdated }: ResultsPanelProps) {
  async function handleExportHtml(job: JobRecord) {
    const updated = await exportJobAsHtml(job);
    if (updated) onJobsUpdated(updated);
  }

  async function handleExportPdf(job: JobRecord) {
    const updated = await exportJobAsPdf(job);
    if (updated) onJobsUpdated(updated);
  }

  async function handleExportEpub(job: JobRecord) {
    const updated = await exportJobAsEpub(job);
    if (updated) onJobsUpdated(updated);
  }

  async function handleExportAll(job: JobRecord) {
    const updated = await exportJobAllViaDesktop(job);
    if (updated) onJobsUpdated(updated);
  }

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Results</h2>
      <p className="mt-1 text-sm text-slate-600">Recorded jobs with crawl-loop execution results.</p>

      {jobs.length === 0 && <p className="mt-4 text-slate-500">No jobs recorded yet.</p>}

      <div className="mt-4 space-y-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p><strong>{job.profileName}</strong> ({job.profileDomain})</p>
            <p>URL: <code className="text-xs">{job.startUrl}</code></p>
            <p>Status: <strong className={statusColor(job.status)}>{job.status}</strong></p>
            <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
            {job.completedAt && <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>}
            {job.note && <p>Note: {job.note}</p>}
            {typeof job.pagesProcessed === 'number' && <p>Pages processed: {job.pagesProcessed}</p>}
            {job.stopReason && <p>Stop reason: {job.stopReason}</p>}
            {stopReasonHelp(job.stopReason) && <p className="text-amber-700">Guidance: {stopReasonHelp(job.stopReason)}</p>}
            {job.error && <p className="text-rose-700">Error: {job.error}</p>}

            {job.extractedPages && job.extractedPages.length > 0 && (
              <div className="mb-2 mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleExportHtml(job)} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white">Export HTML snapshot</button>
                <button type="button" onClick={() => void handleExportPdf(job)} className="rounded bg-indigo-700 px-3 py-1.5 text-sm text-white">Export PDF</button>
                <button type="button" onClick={() => void handleExportEpub(job)} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white">Export EPUB</button>
                <button type="button" onClick={() => void handleExportAll(job)} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white">Export all (desktop bridge)</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
