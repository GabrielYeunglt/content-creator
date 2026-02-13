export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type StartJobInput = {
  startUrl: string;
  profileId: string;
};

export type JobRecord = {
  id: string;
  profileId: string;
  profileName: string;
  profileDomain: string;
  startUrl: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  note?: string;
  extractedPreview?: string;
  nextUrl?: string;
  stopReason?: string;
  error?: string;
  pagesProcessed?: number;
  lastVisitedUrl?: string;
};
