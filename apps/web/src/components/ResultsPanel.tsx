import { useState } from 'react';
import { exportJobAllViaDesktop, exportJobAsEpub, exportJobAsHtml, exportJobAsPdf } from '../lib/exportActions';
import type { JobRecord, JobStatus } from '../types/job';
import { JobDetailsCard } from './JobDetailsCard';

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

  const selectedJob = jobs.find((job) => job.id === detailsJobId) ?? null;

  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Results</h2>
      <p className="mt-1 text-sm text-slate-600">Recorded jobs with crawl-loop execution results.</p>

      {jobs.length === 0 && <p className="mt-4 text-slate-500">No jobs recorded yet.</p>}

      {jobs.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="table-generic">
            <thead className="bg-slate-50">
              <tr>
                <th >Profile</th>
                <th >Status</th>
                <th >Created</th>
                <th >Completed</th>
                <th >Pages</th>
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

      {selectedJob && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Job details</h3>
            <button type="button" onClick={() => setDetailsJobId(null)} className="text-xs text-slate-600 underline">Close</button>
          </div>
          <JobDetailsCard job={selectedJob} />
        </div>
      )}
    </section>
  );
}
