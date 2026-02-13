export type ExportFormat = 'pdf' | 'epub' | 'both';

export type ExportRequest = {
  jobId: string;
  format: ExportFormat;
};
