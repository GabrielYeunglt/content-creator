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

  const selectorRules = (candidate.selectorRules ?? []).filter((rule) => rule.selector.trim().length > 0);
  if (selectorRules.length === 0) {
    return null;
  }

  return {
    id: candidate.id ?? crypto.randomUUID(),
    name: candidate.name.trim(),
    domain: normalizeDomain(candidate.domain),
    selectorRules,
    paginationRule: {
      selectorType: validSelectorType(candidate.paginationRule.selectorType)
        ? candidate.paginationRule.selectorType
        : 'css',
      selector: candidate.paginationRule.selector.trim(),
      attributeName: candidate.paginationRule.attributeName?.trim() || 'href'
    },
    stopRules: {
      stopWhenNoNextButton: Boolean(candidate.stopRules.stopWhenNoNextButton),
      stopWhenUrlVisited: Boolean(candidate.stopRules.stopWhenUrlVisited),
      maxPages: Math.max(1, Number(candidate.stopRules.maxPages) || defaultProfileDraft.maxPages)
    },
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    updatedAt: candidate.updatedAt ?? new Date().toISOString()
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

export function createProfile(draft: ProfileDraft): { ok: true; profile: WebsiteProfile } | { ok: false; error: string } {
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

  const now = new Date().toISOString();
  const profile: WebsiteProfile = {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    domain,
    selectorRules: [
      {
        id: crypto.randomUUID(),
        fieldName: draft.fieldName.trim() || 'body',
        selectorType: draft.selectorType,
        selector: draft.selector.trim(),
        extractMode: draft.extractMode,
        required: draft.required
      }
    ],
    paginationRule: {
      selectorType: draft.nextSelectorType,
      selector: draft.nextSelector.trim(),
      attributeName: draft.nextAttributeName.trim() || 'href'
    },
    stopRules: {
      stopWhenNoNextButton: true,
      stopWhenUrlVisited: true,
      maxPages: Math.max(1, draft.maxPages)
    },
    createdAt: now,
    updatedAt: now
  };

  return { ok: true, profile };
}
