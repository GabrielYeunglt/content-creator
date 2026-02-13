export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ScrapeJob = {
  id: string;
  profileId: string;
  startUrl: string;
  status: JobStatus;
};
