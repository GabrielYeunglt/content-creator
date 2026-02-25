import {
  createDefaultExtractionRules,
  createPreExtractionRule,
  createDefaultProfileDraft,
  type ProfileDraft,
  type SelectorType,
  type WebsiteProfile
} from '../types/profile';

const PROFILE_STORAGE_KEY = 'content-creator:profiles:v1';

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');
}

function validSelectorType(value: string): value is SelectorType {
  return value === 'css' || value === 'xpath';
}

function normalizeMetadataFieldType(fieldType: string | undefined): 'title' | 'author' | 'volume' | 'chapter' | 'publisher' | 'series' | 'subject' | 'cover' | 'language' | 'description' | 'other' {
  if (fieldType === 'volume') return 'volume';
  if (fieldType === 'chapter') return 'volume';
  if (fieldType === 'title' || fieldType === 'author' || fieldType === 'publisher' || fieldType === 'series' || fieldType === 'subject' || fieldType === 'cover' || fieldType === 'language' || fieldType === 'description' || fieldType === 'other') {
    return fieldType;
  }

  return 'title';
}


function normalizePreExtractionRunMode(
  runMode: string | undefined
): 'every-page' | 'start-of-job' {
  return runMode === 'start-of-job' ? 'start-of-job' : 'every-page';
}

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

function sanitizeProfile(candidate: Partial<WebsiteProfile>): WebsiteProfile | null {
  if (!candidate.name || !candidate.domain || !candidate.paginationRule || !candidate.stopRules) {
    return null;
  }

  const selectorRules = (candidate.selectorRules ?? [])
    .filter((rule) => rule.selector.trim().length > 0)
    .map((rule) => ({
      ...rule,
      attributeUrlMode: rule.attributeUrlMode ?? 'value'
    }));
  if (selectorRules.length === 0) {
    return null;
  }

  return {
    id: candidate.id ?? crypto.randomUUID(),
    name: candidate.name.trim(),
    domain: normalizeDomain(candidate.domain),
    profileType: candidate.profileType === 'multi-url' ? 'multi-url' : 'single-url',
    selectorRules,
    metadataRules: (candidate.metadataRules ?? [])
      .filter((rule) => rule.selector.trim().length > 0)
      .map((rule) => ({
        ...rule,
        fieldType: normalizeMetadataFieldType(rule.fieldType),
        customFieldName: rule.customFieldName?.trim() || '',
        attributeUrlMode: rule.attributeUrlMode ?? 'value'
      })),
    paginationRule: {
      selectorType: validSelectorType(candidate.paginationRule.selectorType)
        ? candidate.paginationRule.selectorType
        : 'css',
      selector: candidate.paginationRule.selector.trim(),
      attributeName: candidate.paginationRule.attributeName?.trim() || 'href',
      navigationMode: candidate.paginationRule.navigationMode === 'click'
        ? 'click'
        : candidate.paginationRule.navigationMode === 'url-pattern'
          ? 'url-pattern'
          : 'url-attribute',
      postNavigationDelaySeconds: Math.max(0, Number(candidate.paginationRule.postNavigationDelaySeconds) || 0.5)
    },
    totalPagesRule: candidate.totalPagesRule && candidate.totalPagesRule.selector?.trim()
      ? {
        selectorType: validSelectorType(candidate.totalPagesRule.selectorType)
          ? candidate.totalPagesRule.selectorType
          : 'css',
        selector: candidate.totalPagesRule.selector.trim(),
        attributeName: candidate.totalPagesRule.attributeName?.trim() || undefined
      }
      : undefined,
    preExtractionRules: (candidate.preExtractionRules ?? [])
      .filter((rule) => rule.selector.trim().length > 0)
      .map((rule) => ({
        id: rule.id ?? crypto.randomUUID(),
        selectorType: validSelectorType(rule.selectorType) ? rule.selectorType : 'css',
        selector: rule.selector.trim(),
        action: 'click' as const,
        runMode: normalizePreExtractionRunMode(rule.runMode),
        timeoutMs: Math.max(0, Number(rule.timeoutMs) || 5000)
      })),
    preExtractionMaxFailures: Math.max(1, Number(candidate.preExtractionMaxFailures) || 3),
    stopRules: {
      stopWhenNoNextButton: Boolean(candidate.stopRules.stopWhenNoNextButton),
      stopWhenUrlVisited: Boolean(candidate.stopRules.stopWhenUrlVisited),
      maxPages: Math.max(1, Number(candidate.stopRules.maxPages) || createDefaultProfileDraft().maxPages)
    },
    multiJobWaitSecondsRange: {
      min: Math.max(0, Number(candidate.multiJobWaitSecondsRange?.min) || 0),
      max: Math.max(0, Number(candidate.multiJobWaitSecondsRange?.max) || 0)
    },
    multiUrlOverrides: normalizeMetadataOverrides(candidate.multiUrlOverrides as Record<string, string> | undefined),
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    updatedAt: candidate.updatedAt ?? new Date().toISOString()
  };
}

function validateProfileDraft(draft: ProfileDraft): { ok: true } | { ok: false; error: string } {
  const domain = normalizeDomain(draft.domain);
  if (!draft.name.trim()) {
    return { ok: false, error: 'Profile name is required.' };
  }
  if (!domain || !domain.includes('.')) {
    return { ok: false, error: 'A valid domain is required (example.com).' };
  }

  const waitMin = Math.max(0, Number(draft.multiJobWaitMinSeconds) || 0);
  const waitMax = Math.max(0, Number(draft.multiJobWaitMaxSeconds) || 0);
  if (waitMin > waitMax) {
    return { ok: false, error: 'Multi-job wait range min must be less than or equal to max.' };
  }

  const preExtractionMaxFailures = Math.max(1, Number(draft.preExtractionMaxFailures) || 3);
  if (!Number.isFinite(preExtractionMaxFailures) || preExtractionMaxFailures < 1) {
    return { ok: false, error: 'Pre-extraction max failures must be at least 1.' };
  }

  const invalidRequiredRule = draft.extractionRules.find(
    (rule) => {
      if (!rule.showByDefault || rule.optional) {
        return false;
      }

      if (draft.profileType === 'multi-url' && rule.type === 'pagination') {
        return false;
      }

      if (rule.type === 'pagination' && rule.navigationMode === 'url-pattern') {
        return false;
      }

      return !rule.selector.trim();
    }
  );
  if (invalidRequiredRule) {
    return { ok: false, error: `${invalidRequiredRule.label} selector is required.` };
  }

  return { ok: true };
}

function buildProfile(draft: ProfileDraft, id: string, createdAt: string): WebsiteProfile {
  const contentRule = draft.extractionRules.find((rule) => rule.type === 'content');
  const paginationRule = draft.extractionRules.find((rule) => rule.type === 'pagination');
  const totalPagesRule = draft.extractionRules.find((rule) => rule.type === 'total-pages');

  return {
    id,
    name: draft.name.trim(),
    domain: normalizeDomain(draft.domain),
    profileType: draft.profileType,
    selectorRules: contentRule
      ? [{
        id: crypto.randomUUID(),
        fieldName: contentRule.fieldName?.trim() || 'body',
        selectorType: contentRule.selectorType,
        selector: contentRule.selector.trim(),
        extractMode: contentRule.extractMode,
        attributeName: contentRule.attributeName.trim() || 'href',
        attributeUrlMode: contentRule.attributeUrlMode,
        required: contentRule.required ?? true
      }]
      : [],
    metadataRules: draft.extractionRules
      .filter((rule) => rule.type === 'metadata' && rule.selector.trim().length > 0)
      .map((rule) => ({
        id: rule.id || crypto.randomUUID(),
        fieldType: normalizeMetadataFieldType(rule.fieldType),
        customFieldName: rule.customFieldName?.trim() ?? '',
        selectorType: rule.selectorType,
        selector: rule.selector.trim(),
        extractMode: rule.extractMode,
        attributeName: rule.attributeName.trim() || 'href',
        attributeUrlMode: rule.attributeUrlMode
      })),
    paginationRule: {
      selectorType: paginationRule?.selectorType ?? 'css',
      selector: paginationRule?.selector.trim() ?? '',
      attributeName: paginationRule?.attributeName.trim() || 'href',
      navigationMode: paginationRule?.navigationMode ?? 'url-attribute',
      postNavigationDelaySeconds: Math.max(0, Number(paginationRule?.postNavigationDelaySeconds) || 0.5)
    },
    totalPagesRule: totalPagesRule?.selector.trim()
      ? {
        selectorType: totalPagesRule.selectorType,
        selector: totalPagesRule.selector.trim(),
        attributeName: totalPagesRule.attributeName.trim() || undefined
      }
      : undefined,
    preExtractionRules: draft.extractionRules
      .filter((rule) => rule.type === 'pre-extraction' && rule.selector.trim().length > 0)
      .map((rule) => ({
        id: rule.id || crypto.randomUUID(),
        selectorType: rule.selectorType,
        selector: rule.selector.trim(),
        action: 'click' as const,
        runMode: normalizePreExtractionRunMode(rule.runMode),
        timeoutMs: Math.max(0, Number(rule.timeoutMs) || 5000)
      })),
    preExtractionMaxFailures: Math.max(1, Number(draft.preExtractionMaxFailures) || 3),
    stopRules: {
      stopWhenNoNextButton: true,
      stopWhenUrlVisited: true,
      maxPages: Math.max(1, draft.maxPages)
    },
    multiJobWaitSecondsRange: {
      min: Math.max(0, Number(draft.multiJobWaitMinSeconds) || 0),
      max: Math.max(0, Number(draft.multiJobWaitMaxSeconds) || 0)
    },
    multiUrlOverrides: normalizeMetadataOverrides(draft.multiUrlOverrides as Record<string, string>),
    createdAt,
    updatedAt: new Date().toISOString()
  };
}

export function readProfiles(): WebsiteProfile[] {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<WebsiteProfile>>;
    return parsed
      .map((item) => sanitizeProfile(item))
      .filter((profile): profile is WebsiteProfile => profile !== null);
  } catch {
    return [];
  }
}

export function writeProfiles(profiles: WebsiteProfile[]): void {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function profileToDraft(profile: WebsiteProfile): ProfileDraft {
  const [defaultContent, defaultPagination, defaultTotalPages] = createDefaultExtractionRules();
  const defaultPreExtraction = createPreExtractionRule();
  const primary = profile.selectorRules[0];

  return {
    name: profile.name,
    domain: profile.domain,
    profileType: profile.profileType ?? 'single-url',
    extractionRules: [
      {
        ...defaultContent,
        fieldName: primary?.fieldName ?? defaultContent.fieldName,
        selectorType: primary?.selectorType ?? defaultContent.selectorType,
        selector: primary?.selector ?? defaultContent.selector,
        extractMode: primary?.extractMode ?? defaultContent.extractMode,
        required: primary?.required ?? defaultContent.required,
        attributeName: primary?.attributeName ?? defaultContent.attributeName,
        attributeUrlMode: primary?.attributeUrlMode ?? defaultContent.attributeUrlMode
      },
      ...(profile.metadataRules ?? []).map((rule) => ({
        id: rule.id,
        type: 'metadata' as const,
        label: 'Metadata Extraction',
        showByDefault: false,
        optional: true,
        selectorType: rule.selectorType,
        selector: rule.selector,
        extractMode: rule.extractMode,
        attributeName: rule.attributeName ?? 'href',
        attributeUrlMode: rule.attributeUrlMode ?? 'value',
        fieldType: normalizeMetadataFieldType(rule.fieldType),
        customFieldName: rule.customFieldName ?? ''
      })),
      {
        ...defaultPagination,
        selectorType: profile.paginationRule.selectorType,
        selector: profile.paginationRule.selector,
        attributeName: profile.paginationRule.attributeName,
        navigationMode: profile.paginationRule.navigationMode ?? 'url-attribute',
        postNavigationDelaySeconds: Math.max(0, Number(profile.paginationRule.postNavigationDelaySeconds) || 0.5)
      },
      {
        ...defaultTotalPages,
        selectorType: profile.totalPagesRule?.selectorType ?? defaultTotalPages.selectorType,
        selector: profile.totalPagesRule?.selector ?? defaultTotalPages.selector,
        attributeName: profile.totalPagesRule?.attributeName ?? defaultTotalPages.attributeName
      },
      ...(profile.preExtractionRules ?? []).map((rule) => ({
        ...defaultPreExtraction,
        id: rule.id,
        selectorType: rule.selectorType,
        selector: rule.selector,
        action: rule.action,
        runMode: normalizePreExtractionRunMode(rule.runMode),
        timeoutMs: Math.max(0, Number(rule.timeoutMs) || 5000)
      }))
    ],
    multiUrlOverrides: normalizeMetadataOverrides(profile.multiUrlOverrides as Record<string, string> | undefined),
    maxPages: profile.stopRules.maxPages,
    preExtractionMaxFailures: Math.max(1, Number(profile.preExtractionMaxFailures) || 3),
    multiJobWaitMinSeconds: Math.max(0, Number(profile.multiJobWaitSecondsRange?.min) || 0),
    multiJobWaitMaxSeconds: Math.max(0, Number(profile.multiJobWaitSecondsRange?.max) || 0)
  };
}

export function createProfile(draft: ProfileDraft): { ok: true; profile: WebsiteProfile } | { ok: false; error: string } {
  const validation = validateProfileDraft(draft);
  if (!validation.ok) {
    return validation;
  }

  const now = new Date().toISOString();
  const profile = buildProfile(draft, crypto.randomUUID(), now);

  return { ok: true, profile };
}

export function editProfile(
  existingProfile: WebsiteProfile,
  draft: ProfileDraft
): { ok: true; profile: WebsiteProfile } | { ok: false; error: string } {
  const validation = validateProfileDraft(draft);
  if (!validation.ok) {
    return validation;
  }

  const profile = buildProfile(draft, existingProfile.id, existingProfile.createdAt);
  return { ok: true, profile };
}
