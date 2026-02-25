import type { JobProfile, JobProfileDraft } from '../types/jobProfile';

const JOB_PROFILE_STORAGE_KEY = 'content-creator:job-profiles:v1';

function normalizeMetadataOverrides(overrides: Record<string, string> | undefined): Record<string, string> {
  if (!overrides) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    const normalizedKey = key === 'chapter' ? 'volume' : key;
    normalized[normalizedKey] = value;
  }

  return normalized;
}

function sanitizeJobProfile(candidate: Partial<JobProfile>): JobProfile | null {
  if (!candidate.name || !candidate.baseProfileId) {
    return null;
  }

  return {
    id: candidate.id ?? crypto.randomUUID(),
    name: candidate.name.trim(),
    baseProfileId: candidate.baseProfileId,
    contentSelectorOverride: candidate.contentSelectorOverride?.trim() || undefined,
    paginationSelectorOverride: candidate.paginationSelectorOverride?.trim() || undefined,
    totalPagesSelectorOverride: candidate.totalPagesSelectorOverride?.trim() || undefined,
    maxPagesOverride: typeof candidate.maxPagesOverride === 'number' && candidate.maxPagesOverride > 0
      ? Math.floor(candidate.maxPagesOverride)
      : undefined,
    metadataOverrides: normalizeMetadataOverrides(candidate.metadataOverrides as Record<string, string> | undefined),
    exportDestination: candidate.exportDestination?.trim() || '',
    exportFileNameTemplate: candidate.exportFileNameTemplate?.trim() || '{{job.id}}-{{date}}',
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    updatedAt: candidate.updatedAt ?? new Date().toISOString()
  };
}

function validateJobProfileDraft(draft: JobProfileDraft): { ok: true } | { ok: false; error: string } {
  if (!draft.name.trim()) {
    return { ok: false, error: 'Job profile name is required.' };
  }

  if (!draft.baseProfileId) {
    return { ok: false, error: 'A base website profile is required.' };
  }

  if (!draft.exportFileNameTemplate.trim()) {
    return { ok: false, error: 'Export file name format is required.' };
  }

  return { ok: true };
}

function buildJobProfile(draft: JobProfileDraft, id: string, createdAt: string): JobProfile {
  return {
    id,
    name: draft.name.trim(),
    baseProfileId: draft.baseProfileId,
    contentSelectorOverride: draft.contentSelectorOverride.trim() || undefined,
    paginationSelectorOverride: draft.paginationSelectorOverride.trim() || undefined,
    totalPagesSelectorOverride: draft.totalPagesSelectorOverride.trim() || undefined,
    maxPagesOverride: typeof draft.maxPagesOverride === 'number' && draft.maxPagesOverride > 0
      ? Math.floor(draft.maxPagesOverride)
      : undefined,
    metadataOverrides: normalizeMetadataOverrides(draft.metadataOverrides as Record<string, string>),
    exportDestination: draft.exportDestination,
    exportFileNameTemplate: draft.exportFileNameTemplate.trim(),
    createdAt,
    updatedAt: new Date().toISOString()
  };
}

export function readJobProfiles(): JobProfile[] {
  const raw = window.localStorage.getItem(JOB_PROFILE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<JobProfile>>;
    return parsed.map(sanitizeJobProfile).filter((p): p is JobProfile => p !== null);
  } catch {
    return [];
  }
}

export function writeJobProfiles(profiles: JobProfile[]): void {
  window.localStorage.setItem(JOB_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function createJobProfile(draft: JobProfileDraft): { ok: true; profile: JobProfile } | { ok: false; error: string } {
  const validation = validateJobProfileDraft(draft);
  if (!validation.ok) {
    return validation;
  }

  const now = new Date().toISOString();
  return { ok: true, profile: buildJobProfile(draft, crypto.randomUUID(), now) };
}

export function editJobProfile(existing: JobProfile, draft: JobProfileDraft): { ok: true; profile: JobProfile } | { ok: false; error: string } {
  const validation = validateJobProfileDraft(draft);
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, profile: buildJobProfile(draft, existing.id, existing.createdAt) };
}

export function jobProfileToDraft(profile: JobProfile): JobProfileDraft {
  return {
    name: profile.name,
    baseProfileId: profile.baseProfileId,
    contentSelectorOverride: profile.contentSelectorOverride ?? '',
    paginationSelectorOverride: profile.paginationSelectorOverride ?? '',
    totalPagesSelectorOverride: profile.totalPagesSelectorOverride ?? '',
    maxPagesOverride: profile.maxPagesOverride ?? '',
    metadataOverrides: normalizeMetadataOverrides(profile.metadataOverrides as Record<string, string> | undefined),
    exportDestination: profile.exportDestination ?? '',
    exportFileNameTemplate: profile.exportFileNameTemplate ?? '{{job.id}}-{{date}}'
  };
}
