import { useState } from 'react';
import { exportJobAllViaDesktop, exportJobAsEpub, exportJobAsHtml, exportJobAsPdf } from '../lib/exportActions';
import type { JobRecord, JobStatus } from '../types/job';
import { JobDetailsCard } from './JobDetailsCard';
import { getJobProgressInfo } from './jobProgress';

type ResultsPanelProps = {
  jobs: JobRecord[];
  onJobsUpdated: (jobs: JobRecord[]) => void;
};

function statusColor(status: JobStatus): string {
  if (status === 'queued') return 'text-amber-700';
  if (status === 'running') return 'text-blue-700';
  if (status === 'completed') return 'text-green-700';
  return 'text-rose-700';
}

export function ResultsPanel({ jobs, onJobsUpdated }: ResultsPanelProps) {
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);

  async function handleExportHtml(job: JobRecord) {
    setExportingJobId(job.id);
    try {
      const updated = await exportJobAsHtml(job);
      if (updated) onJobsUpdated(updated);
    } finally {
      setExportingJobId(null);
    }
  }

  async function handleExportPdf(job: JobRecord) {
    setExportingJobId(job.id);
    try {
      const updated = await exportJobAsPdf(job);
      if (updated) onJobsUpdated(updated);
    } finally {
      setExportingJobId(null);
    }
  }

  async function handleExportEpub(job: JobRecord) {
    setExportingJobId(job.id);
    try {
      const updated = await exportJobAsEpub(job);
      if (updated) onJobsUpdated(updated);
    } finally {
      setExportingJobId(null);
    }
  }

  async function handleExportAll(job: JobRecord) {
    setExportingJobId(job.id);
    try {
      const updated = await exportJobAllViaDesktop(job);
      if (updated) onJobsUpdated(updated);
    } finally {
      setExportingJobId(null);
    }
  }

  const selectedJob = jobs.find((job) => job.id === detailsJobId) ?? null;

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Results</h2>
      <p className="mt-1 text-sm text-slate-600">Recorded jobs with crawl-loop execution results.</p>

      {jobs.length === 0 && <p className="mt-4 text-slate-500">No jobs recorded yet.</p>}

      {selectedJob && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            onClick={() => setDetailsJobId(null)}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Back to results table
          </button>
          <JobDetailsCard job={selectedJob} />
        </div>
      )}

      {jobs.length > 0 && !selectedJob && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="table-generic">
            <thead className="bg-slate-50">
              <tr>
                <th >Profile</th>
                <th >Status</th>
                <th >Created</th>
                <th >Completed</th>
                <th >Pages</th>
                <th >Progress</th>
                <th >Actions</th>
              </tr>
            </thead>
            <tbody >
              {jobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td >
                    <p className="font-medium text-slate-900">{job.profileName}</p>
                    <p className="text-xs text-slate-500">{job.profileDomain}</p>
                  </td>
                  <td ><span className={statusColor(job.status)}>{job.status}</span></td>
                  <td >{new Date(job.createdAt).toLocaleString()}</td>
                  <td >{job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}</td>
                  <td >{typeof job.pagesProcessed === 'number' ? job.pagesProcessed : '-'}</td>
                  <td>
                    {(() => {
                      const progress = getJobProgressInfo(job);
                      const isExporting = exportingJobId === job.id;
                      const estimatedTotalSteps = Math.max(3, (job.extractedPages?.length ?? job.pagesProcessed ?? 1) + 2);
                      const exportPercent = isExporting ? 70 : progress.percent;
                      return (
                        <div className="min-w-44">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                            <span>{isExporting ? 'Exporting' : progress.label}</span>
                            <span>{Math.round(exportPercent)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className={`h-full rounded-full ${isExporting ? 'bg-indigo-600' : 'bg-blue-600'} transition-all`} style={{ width: `${exportPercent}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {isExporting
                              ? `${Math.round(estimatedTotalSteps * 0.7)}/${estimatedTotalSteps} estimated export steps`
                              : progress.detail}
                          </p>
                        </div>
                      );
                    })()}
                  </td>
                  <td >
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setDetailsJobId(job.id)} className="rounded bg-slate-600 px-2 py-1 text-xs text-white">View details</button>
                      {job.extractedPages && job.extractedPages.length > 0 && (
                        <>
                          <button type="button" onClick={() => void handleExportHtml(job)} className="rounded bg-slate-800 px-2 py-1 text-xs text-white">Export HTML</button>
                          <button type="button" onClick={() => void handleExportPdf(job)} className="rounded bg-indigo-700 px-2 py-1 text-xs text-white">Export PDF</button>
                          <button type="button" onClick={() => void handleExportEpub(job)} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white">Export EPUB</button>
                          <button type="button" onClick={() => void handleExportAll(job)} className="rounded bg-blue-700 px-2 py-1 text-xs text-white">Export all</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
