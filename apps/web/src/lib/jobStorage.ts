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

export function updateJobStatus(jobId: string, status: JobStatus, note?: string): JobRecord[] {
  return updateJob(jobId, {
    status,
    note,
    completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined
  });
}

export function updateJob(jobId: string, patch: Partial<JobRecord>): JobRecord[] {
  const jobs = readJobs();
  const updated = jobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }

    return {
      ...job,
      ...patch,
      completedAt: patch.completedAt ?? job.completedAt
    };
  });

  writeJobs(updated);
  return updated;
}
