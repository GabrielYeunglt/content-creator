import type { ExportFormat } from '@content-creator/export-engine';

export type AppSettings = {
  strictDomainOnly: boolean;
  maxPagesDefault: number;
  defaultExportFormat: ExportFormat;
};

export const defaultSettings: AppSettings = {
  strictDomainOnly: true,
  maxPagesDefault: 100,
  defaultExportFormat: 'both'
};
