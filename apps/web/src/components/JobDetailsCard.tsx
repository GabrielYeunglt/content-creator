import type { JobRecord, JobStatus } from '../types/job';
import { getJobProgressInfo } from './jobProgress';

type JobDetailsCardProps = {
  job: JobRecord;
  isExporting?: boolean;
  exportPercent?: number;
  onExportHtml?: (job: JobRecord) => void;
  onExportPdf?: (job: JobRecord) => void;
  onExportEpub?: (job: JobRecord) => void;
  onExportAll?: (job: JobRecord) => void;
  onStopCrawl?: (job: JobRecord) => void;
  onStopExport?: (job: JobRecord) => void;
};

function stopReasonHelp(stopReason: string | undefined): string | null {
  if (!stopReason) return null;
  if (stopReason === 'desktop-crawler-bridge-missing') return 'Crawler bridge is not connected. Run desktop/backend runtime and expose __CONTENT_CREATOR_DESKTOP_CRAWLER__.';
  if (stopReason === 'virtual-browser-crawl-error') return 'Desktop crawl failed. Check backend logs, target URL reachability, and selector configuration.';
  if (stopReason === 'out-of-domain-blocked') return 'Next URL left the configured domain. Update profile domain or pagination selector if needed.';
  if (stopReason === 'desktop-export-bridge-missing') return 'Selected job profile export destination is desktop, but export bridge is unavailable.';
  if (stopReason === 'cancelled') return 'Job was cancelled by user.';
  return null;
}

function statusColor(status: JobStatus): string {
  if (status === 'queued') return 'text-amber-700';
  if (status === 'running') return 'text-blue-700';
  if (status === 'completed') return 'text-green-700';
  if (status === 'cancelled') return 'text-slate-600';
  return 'text-rose-700';
}

export function JobDetailsCard({
  job,
  isExporting = false,
  exportPercent = 0,
  onExportHtml,
  onExportPdf,
  onExportEpub,
  onExportAll,
  onStopCrawl,
  onStopExport
}: JobDetailsCardProps) {
  const progress = getJobProgressInfo(job, isExporting ? 'export' : 'crawl');
  const percent = isExporting ? exportPercent : progress.percent;
  const canExport = Boolean(job.extractedPages && job.extractedPages.length > 0);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700">
          <span>{progress.label}</span>
          <span>{Math.round(percent)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${isExporting ? 'bg-indigo-600' : 'bg-blue-600'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-600">{progress.detail}</p>
      </div>

      <div className="grid gap-1 text-sm text-slate-700">
        <p><strong>Job:</strong> <code>{job.id}</code></p>
        <p><strong>Status:</strong> <span className={statusColor(job.status)}>{job.status}</span></p>
        <p><strong>Profile:</strong> {job.profileName} ({job.profileDomain})</p>
        <p><strong>Start URL:</strong> <code className="text-xs">{job.startUrl}</code></p>
        <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>
        {job.completedAt && <p><strong>Completed:</strong> {new Date(job.completedAt).toLocaleString()}</p>}
        {typeof job.pagesProcessed === 'number' && <p><strong>Pages processed:</strong> {job.pagesProcessed}</p>}
        {job.lastVisitedUrl && <p><strong>Last URL:</strong> <code className="text-xs">{job.lastVisitedUrl}</code></p>}
        {job.note && <p><strong>Note:</strong> {job.note}</p>}
        {job.stopReason && <p><strong>Stop reason:</strong> {job.stopReason}</p>}
        {stopReasonHelp(job.stopReason) && <p className="text-amber-700"><strong>Guidance:</strong> {stopReasonHelp(job.stopReason)}</p>}
        {job.error && <p className="text-rose-700"><strong>Error:</strong> {job.error}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {job.status === 'running' && !isExporting && (
          <button type="button" onClick={() => onStopCrawl?.(job)} className="rounded bg-rose-700 px-2 py-1 text-xs text-white">
            Stop crawl
          </button>
        )}
        {isExporting && (
          <button type="button" onClick={() => onStopExport?.(job)} className="rounded bg-rose-700 px-2 py-1 text-xs text-white">
            Stop export
          </button>
        )}
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h4 className="text-sm font-semibold text-slate-800">Export actions</h4>
        {!canExport && <p className="mt-2 text-xs text-slate-500">Export becomes available after crawl has extracted pages.</p>}
        {canExport && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => onExportHtml?.(job)} className="rounded bg-slate-800 px-2 py-1 text-xs text-white">Export HTML</button>
            <button type="button" onClick={() => onExportPdf?.(job)} className="rounded bg-indigo-700 px-2 py-1 text-xs text-white">Export PDF</button>
            <button type="button" onClick={() => onExportEpub?.(job)} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white">Export EPUB</button>
            <button type="button" onClick={() => onExportAll?.(job)} className="rounded bg-blue-700 px-2 py-1 text-xs text-white">Export all</button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">Job log</h4>
        {job.logs && job.logs.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {job.logs.map((entry, index) => (
              <li key={`${job.id}-${index}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <span className="font-medium">[{new Date(entry.at).toLocaleTimeString()}] {entry.level.toUpperCase()}</span> {entry.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No log entries yet.</p>
        )}
      </div>
    </article>
  );
}
