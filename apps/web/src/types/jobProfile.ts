import type { MetadataFieldType } from './profile';

export type JobMode = 'single' | 'multi';
export type ExportDestination = string;

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
  titleOverrideTemplate?: string;
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
  titleOverrideTemplate: string;
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
    exportDestination: '',
    exportFileNameTemplate: '{{job.id}}-{{date}}',
    titleOverrideTemplate: ''
  };
}
