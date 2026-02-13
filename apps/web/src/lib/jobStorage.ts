import type { JobRecord } from '../types/job';

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
