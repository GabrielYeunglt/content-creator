import type { MetadataFieldType } from './profile';

export type JobMode = 'single' | 'multi';

export type JobProfile = {
  id: string;
  name: string;
  baseProfileId: string;
  contentSelectorOverride?: string;
  paginationSelectorOverride?: string;
  totalPagesSelectorOverride?: string;
  maxPagesOverride?: number;
  metadataOverrides?: Partial<Record<MetadataFieldType | 'other', string>>;
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
};

export function createDefaultJobProfileDraft(): JobProfileDraft {
  return {
    name: '',
    baseProfileId: '',
    contentSelectorOverride: '',
    paginationSelectorOverride: '',
    totalPagesSelectorOverride: '',
    maxPagesOverride: '',
    metadataOverrides: {}
  };
}
