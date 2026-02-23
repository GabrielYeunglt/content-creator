import type { MetadataFieldType } from './profile';

export type JobMode = 'single' | 'multi';
export type ExportDestination = 'desktop-artifacts' | 'browser-download';

export type JobProfile = {
  id: string;
  name: string;
  baseProfileId: string;
  contentSelectorOverride?: string;
  paginationSelectorOverride?: string;
  totalPagesSelectorOverride?: string;
  maxPagesOverride?: number;
  metadataOverrides?: Partial<Record<MetadataFieldType | 'other', string>>;
  exportDestination?: ExportDestination;
  exportFileNameTemplate?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobProfileDraft = {
  name: string;
  baseProfileId: string;
  contentSelectorOverride: string;
  paginationSelectorOverride: string;
  totalPagesSelectorOverride: string;
  maxPagesOverride: number | '';
  metadataOverrides: Partial<Record<MetadataFieldType | 'other', string>>;
  exportDestination: ExportDestination;
  exportFileNameTemplate: string;
};

export function createDefaultJobProfileDraft(): JobProfileDraft {
  return {
    name: '',
    baseProfileId: '',
    contentSelectorOverride: '',
    paginationSelectorOverride: '',
    totalPagesSelectorOverride: '',
    maxPagesOverride: '',
    metadataOverrides: {},
    exportDestination: 'desktop-artifacts',
    exportFileNameTemplate: '{{job.id}}-{{date}}'
  };
}
