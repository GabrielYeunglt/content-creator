import type { WebsiteProfile } from '@content-creator/shared-types';

export function matchesDomain(profile: WebsiteProfile, hostname: string): boolean {
  const normalized = hostname.replace(/^www\./, '').toLowerCase();
  const profileDomain = profile.domain.replace(/^www\./, '').toLowerCase();
  return normalized === profileDomain;
}
