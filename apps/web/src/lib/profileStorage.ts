import {
  defaultProfileDraft,
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
      attributeUrlMode: rule.attributeUrlMode ?? defaultProfileDraft.contentAttributeUrlMode
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
        attributeUrlMode: rule.attributeUrlMode ?? defaultProfileDraft.contentAttributeUrlMode
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
      maxPages: Math.max(1, Number(candidate.stopRules.maxPages) || defaultProfileDraft.maxPages)
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
  if (!draft.selector.trim()) {
    return { ok: false, error: 'Primary selector is required.' };
  }
  if (!draft.nextSelector.trim()) {
    return { ok: false, error: 'Next-page selector is required.' };
  }

  return { ok: true };
}

function buildProfile(draft: ProfileDraft, id: string, createdAt: string): WebsiteProfile {
  return {
    id,
    name: draft.name.trim(),
    domain: normalizeDomain(draft.domain),
    selectorRules: [
      {
        id: crypto.randomUUID(),
        fieldName: draft.fieldName.trim() || 'body',
        selectorType: draft.selectorType,
        selector: draft.selector.trim(),
        extractMode: draft.extractMode,
        attributeName: draft.contentAttributeName.trim() || 'href',
        attributeUrlMode: draft.contentAttributeUrlMode,
        required: draft.required
      }
    ],
    metadataRules: draft.metadataRules
      .filter((rule) => rule.selector.trim().length > 0)
      .map((rule) => ({
        id: rule.id || crypto.randomUUID(),
        fieldType: rule.fieldType,
        customFieldName: rule.customFieldName.trim(),
        selectorType: rule.selectorType,
        selector: rule.selector.trim(),
        extractMode: rule.extractMode,
        attributeName: rule.attributeName.trim() || 'href',
        attributeUrlMode: rule.attributeUrlMode
      })),
    paginationRule: {
      selectorType: draft.nextSelectorType,
      selector: draft.nextSelector.trim(),
      attributeName: draft.nextAttributeName.trim() || 'href',
      navigationMode: draft.nextNavigationMode
    },
    totalPagesRule: draft.totalPagesSelector.trim()
      ? {
        selectorType: draft.totalPagesSelectorType,
        selector: draft.totalPagesSelector.trim(),
        attributeName: draft.totalPagesAttributeName.trim() || undefined
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
  const primary = profile.selectorRules[0];
  return {
    name: profile.name,
    domain: profile.domain,
    fieldName: primary?.fieldName ?? defaultProfileDraft.fieldName,
    selectorType: primary?.selectorType ?? defaultProfileDraft.selectorType,
    selector: primary?.selector ?? defaultProfileDraft.selector,
    extractMode: primary?.extractMode ?? defaultProfileDraft.extractMode,
    required: primary?.required ?? defaultProfileDraft.required,
    contentAttributeName: primary?.attributeName ?? defaultProfileDraft.contentAttributeName,
    contentAttributeUrlMode: primary?.attributeUrlMode ?? defaultProfileDraft.contentAttributeUrlMode,
    metadataRules: (profile.metadataRules ?? []).map((rule) => ({
      id: rule.id,
      fieldType: rule.fieldType,
      customFieldName: rule.customFieldName ?? '',
      selectorType: rule.selectorType,
      selector: rule.selector,
      extractMode: rule.extractMode,
      attributeName: rule.attributeName ?? 'href',
      attributeUrlMode: rule.attributeUrlMode ?? defaultProfileDraft.contentAttributeUrlMode
    })),
    nextSelectorType: profile.paginationRule.selectorType,
    nextSelector: profile.paginationRule.selector,
    nextAttributeName: profile.paginationRule.attributeName,
    nextNavigationMode: profile.paginationRule.navigationMode ?? 'url-attribute',
    totalPagesSelectorType: profile.totalPagesRule?.selectorType ?? defaultProfileDraft.totalPagesSelectorType,
    totalPagesSelector: profile.totalPagesRule?.selector ?? defaultProfileDraft.totalPagesSelector,
    totalPagesAttributeName: profile.totalPagesRule?.attributeName ?? defaultProfileDraft.totalPagesAttributeName,
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
