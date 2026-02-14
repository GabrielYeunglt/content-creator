export type ExportFormat = 'pdf' | 'epub' | 'both';

export type AppSettings = {
  outputDir: string;
  maxPagesDefault: number;
  requestTimeoutMs: number;
  delayMsBetweenPages: number;
  strictDomainOnly: boolean;
  defaultExportFormat: ExportFormat;
};

export const defaultAppSettings: AppSettings = {
  outputDir: 'exports',
  maxPagesDefault: 100,
  requestTimeoutMs: 15000,
  delayMsBetweenPages: 250,
  strictDomainOnly: true,
  defaultExportFormat: 'both'
};
