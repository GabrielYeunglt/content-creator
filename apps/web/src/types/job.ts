export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ConsolidatedDocumentRecord = {
  id: string;
  title: string;
  sourceDomain: string;
  generatedAt: string;
  chapterCount: number;
};

export type ExportedArtifactRecord = {
  format: 'html' | 'pdf' | 'epub' | 'epub-manifest';
  path: string;
  createdAt: string;
};

export type StartJobInput = {
  startUrl: string;
  profileId: string;
};

export type ExtractedPageRecord = {
  url: string;
  preview: string;
  stylesheets?: string[];
  scripts?: string[];
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
  extractedPages?: ExtractedPageRecord[];
  nextUrl?: string;
  stopReason?: string;
  error?: string;
  pagesProcessed?: number;
  lastVisitedUrl?: string;
  consolidatedDocument?: ConsolidatedDocumentRecord;
  exportedArtifacts?: ExportedArtifactRecord[];
  logs?: Array<{
    at: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
};
