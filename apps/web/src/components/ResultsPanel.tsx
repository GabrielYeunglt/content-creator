import { useEffect, useState } from 'react';
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
  const [exportPercent, setExportPercent] = useState(0);

  useEffect(() => {
    if (!exportingJobId) {
      setExportPercent(0);
      return;
    }

    setExportPercent(0);
    const interval = window.setInterval(() => {
      setExportPercent((current) => Math.min(92, current + 8));
    }, 250);

    return () => window.clearInterval(interval);
  }, [exportingJobId]);

  async function runExport(job: JobRecord, action: (value: JobRecord) => Promise<JobRecord[] | null>) {
    setExportingJobId(job.id);
    try {
      const updated = await action(job);
      setExportPercent(100);
      if (updated) onJobsUpdated(updated);
    } finally {
      window.setTimeout(() => {
        setExportingJobId(null);
        setExportPercent(0);
      }, 250);
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
          <JobDetailsCard
            job={selectedJob}
            isExporting={exportingJobId === selectedJob.id}
            exportPercent={exportingJobId === selectedJob.id ? exportPercent : 0}
            onExportHtml={(job) => void runExport(job, exportJobAsHtml)}
            onExportPdf={(job) => void runExport(job, exportJobAsPdf)}
            onExportEpub={(job) => void runExport(job, exportJobAsEpub)}
            onExportAll={(job) => void runExport(job, exportJobAllViaDesktop)}
          />
        </div>
      )}

      {jobs.length > 0 && !selectedJob && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="table-generic">
            <thead className="bg-slate-50">
              <tr>
                <th>Profile</th><th>Status</th><th>Created</th><th>Completed</th><th>Pages</th><th>Progress</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const isExporting = exportingJobId === job.id;
                const progress = getJobProgressInfo(job, isExporting ? 'export' : 'crawl');
                const percent = isExporting ? exportPercent : progress.percent;
                return (
                  <tr key={job.id} className="align-top">
                    <td><p className="font-medium text-slate-900">{job.profileName}</p><p className="text-xs text-slate-500">{job.profileDomain}</p></td>
                    <td><span className={statusColor(job.status)}>{job.status}</span></td>
                    <td>{new Date(job.createdAt).toLocaleString()}</td>
                    <td>{job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}</td>
                    <td>{typeof job.pagesProcessed === 'number' ? job.pagesProcessed : '-'}</td>
                    <td>
                      <div className="min-w-44">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600"><span>{progress.label}</span><span>{Math.round(percent)}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${isExporting ? 'bg-indigo-600' : 'bg-blue-600'} transition-all`} style={{ width: `${percent}%` }} /></div>
                        <p className="mt-1 text-[11px] text-slate-500">{progress.detail}</p>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setDetailsJobId(job.id)} className="rounded bg-slate-600 px-2 py-1 text-xs text-white">View details</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
