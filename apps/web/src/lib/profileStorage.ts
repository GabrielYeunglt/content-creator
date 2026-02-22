import {
  createDefaultExtractionRules,
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
    selectorRules,
    metadataRules: (candidate.metadataRules ?? [])
      .filter((rule) => rule.selector.trim().length > 0)
      .map((rule) => ({
        ...rule,
        customFieldName: rule.customFieldName?.trim() || '',
        attributeUrlMode: rule.attributeUrlMode ?? 'value'
      })),
    paginationRule: {
      selectorType: validSelectorType(candidate.paginationRule.selectorType)
        ? candidate.paginationRule.selectorType
        : 'css',
      selector: candidate.paginationRule.selector.trim(),
      attributeName: candidate.paginationRule.attributeName?.trim() || 'href',
      navigationMode: candidate.paginationRule.navigationMode === 'click' ? 'click' : 'url-attribute'
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
    stopRules: {
      stopWhenNoNextButton: Boolean(candidate.stopRules.stopWhenNoNextButton),
      stopWhenUrlVisited: Boolean(candidate.stopRules.stopWhenUrlVisited),
      maxPages: Math.max(1, Number(candidate.stopRules.maxPages) || createDefaultProfileDraft().maxPages)
    },
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

  const invalidRequiredRule = draft.extractionRules.find(
    (rule) => rule.showByDefault && !rule.optional && !rule.selector.trim()
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
        fieldType: rule.fieldType ?? 'title',
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
      navigationMode: paginationRule?.navigationMode ?? 'url-attribute'
    },
    totalPagesRule: totalPagesRule?.selector.trim()
      ? {
        selectorType: totalPagesRule.selectorType,
        selector: totalPagesRule.selector.trim(),
        attributeName: totalPagesRule.attributeName.trim() || undefined
      }
      : undefined,
    stopRules: {
      stopWhenNoNextButton: true,
      stopWhenUrlVisited: true,
      maxPages: Math.max(1, draft.maxPages)
    },
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
  const primary = profile.selectorRules[0];

  return {
    name: profile.name,
    domain: profile.domain,
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
        fieldType: rule.fieldType,
        customFieldName: rule.customFieldName ?? ''
      })),
      {
        ...defaultPagination,
        selectorType: profile.paginationRule.selectorType,
        selector: profile.paginationRule.selector,
        attributeName: profile.paginationRule.attributeName,
        navigationMode: profile.paginationRule.navigationMode ?? 'url-attribute'
      },
      {
        ...defaultTotalPages,
        selectorType: profile.totalPagesRule?.selectorType ?? defaultTotalPages.selectorType,
        selector: profile.totalPagesRule?.selector ?? defaultTotalPages.selector,
        attributeName: profile.totalPagesRule?.attributeName ?? defaultTotalPages.attributeName
      }
    ],
    maxPages: profile.stopRules.maxPages
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
