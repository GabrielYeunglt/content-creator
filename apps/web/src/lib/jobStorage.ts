import type { JobRecord, JobStatus } from '../types/job';

const JOB_STORAGE_KEY = 'content-creator:jobs:v1';
const MAX_STORED_JOBS = 25;
const MAX_STORED_LOGS_PER_JOB = 200;

function normalizeJobsForStorage(jobs: JobRecord[]): JobRecord[] {
  return jobs.slice(0, MAX_STORED_JOBS).map((job) => ({
    ...job,
    logs: job.logs?.slice(-MAX_STORED_LOGS_PER_JOB),
    extractedPages: job.extractedPages?.map((page) => ({
      ...page,
      stylesheets: undefined,
      scripts: undefined
    }))
  }));
}

function dropHeavyExtractedFields(jobs: JobRecord[], keepLatestCount: number): JobRecord[] {
  return jobs.map((job, index) => {
    if (index < keepLatestCount) {
      return job;
    }

    return {
      ...job,
      extractedPreview: undefined,
      extractedPages: undefined
    };
  });
}

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
  const normalizedJobs = normalizeJobsForStorage(jobs);

  try {
    window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(normalizedJobs));
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') {
      throw error;
    }

    const withoutOlderExtractedData = dropHeavyExtractedFields(normalizedJobs, 1);

    try {
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(withoutOlderExtractedData));
    } catch (secondError) {
      if (!(secondError instanceof DOMException) || secondError.name !== 'QuotaExceededError') {
        throw secondError;
      }

      const minimalJobs = dropHeavyExtractedFields(normalizedJobs, 0);
      window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(minimalJobs));
    }
  }
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

export function appendJobLog(
  jobId: string,
  entry: {
    level: 'info' | 'warn' | 'error';
    message: string;
    at?: string;
  }
): JobRecord[] {
  const jobs = readJobs();
  const updated = jobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }

    return {
      ...job,
      logs: [
        ...(job.logs ?? []),
        {
          at: entry.at ?? new Date().toISOString(),
          level: entry.level,
          message: entry.message
        }
      ]
    };
  });

  writeJobs(updated);
  return updated;
}
