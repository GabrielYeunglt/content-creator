import type { JobRecord, JobStatus } from '../types/job';

const JOB_STORAGE_KEY = 'content-creator:jobs:v1';

export function readJobs(): JobRecord[] {
  const raw = window.localStorage.getItem(JOB_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as JobRecord[];
    return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function writeJobs(jobs: JobRecord[]): void {
  window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs));
}

export function appendJob(job: JobRecord): JobRecord[] {
  const jobs = readJobs();
  const updated = [job, ...jobs];
  writeJobs(updated);
  return updated;
}

export function updateJobStatus(
  jobId: string,
  status: JobStatus,
  note?: string
): JobRecord[] {
  const jobs = readJobs();
  const updated = jobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }

    const isTerminal = status === 'completed' || status === 'failed';

    return {
      ...job,
      status,
      completedAt: isTerminal ? new Date().toISOString() : job.completedAt,
      note: note ?? job.note
    };
  });

  writeJobs(updated);
  return updated;
}
