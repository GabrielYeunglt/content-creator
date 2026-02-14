import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { runCrawlJob } from '../lib/jobRunner';
import { appendJob } from '../lib/jobStorage';
import type { JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';

const CREATE_PROFILE_OPTION_VALUE = '__create_profile__';

type StartJobPanelProps = {
  profiles: WebsiteProfile[];
  onJobCreated: (jobs: JobRecord[]) => void;
  onRequestCreateProfile: () => void;
};

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function StartJobPanel({ profiles, onJobCreated, onRequestCreateProfile }: StartJobPanelProps) {
  const [startUrl, setStartUrl] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetHost = useMemo(() => hostFromUrl(startUrl.trim()), [startUrl]);

  const matchingProfiles = useMemo(() => {
    if (!targetHost) {
      return profiles;
    }

    return profiles.filter((profile) => profile.domain === targetHost);
  }, [profiles, targetHost]);

  useEffect(() => {
    if (!targetHost) {
      return;
    }

    if (matchingProfiles.length === 0) {
      setSelectedProfileId(CREATE_PROFILE_OPTION_VALUE);
      return;
    }

    setSelectedProfileId((current) => {
      const stillValid = matchingProfiles.some((profile) => profile.id === current);
      if (stillValid) {
        return current;
      }

      return matchingProfiles[0].id;
    });
  }, [targetHost, matchingProfiles]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hostname = hostFromUrl(startUrl.trim());
    if (!hostname) {
      setMessage('Please provide a valid URL (include http/https).');
      return;
    }

    if (!selectedProfile) {
      setMessage('Please select a profile.');
      return;
    }

    if (hostname !== selectedProfile.domain) {
      setMessage(
        `Domain mismatch: URL is ${hostname} but selected profile is ${selectedProfile.domain}.`
      );
      return;
    }

    setIsSubmitting(true);

    const now = new Date().toISOString();
    const newJob: JobRecord = {
      id: crypto.randomUUID(),
      profileId: selectedProfile.id,
      profileName: selectedProfile.name,
      profileDomain: selectedProfile.domain,
      startUrl: startUrl.trim(),
      status: 'queued',
      createdAt: now,
      note: 'Queued for crawl execution.'
    };

    const queuedJobs = appendJob(newJob);
    onJobCreated(queuedJobs);
    setMessage('Job queued. Running crawl loop...');

    try {
      await runCrawlJob(newJob.id, {
        onJobsUpdated: onJobCreated,
        profile: selectedProfile,
        startUrl: startUrl.trim()
      });
      setMessage('Crawl run finished. Check Results for pages processed, preview, and stop reason.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleProfileSelectionChange(value: string) {
    if (value === CREATE_PROFILE_OPTION_VALUE) {
      onRequestCreateProfile();
      return;
    }

    setSelectedProfileId(value);
  }

  const shouldShowCreateOption = Boolean(targetHost) && matchingProfiles.length === 0;

  return (
    <section>
      <h2>Start Job</h2>
      <p>Pick a profile, enter a starting URL, and validate strict in-domain matching.</p>
      <p style={{ color: '#8a4f00' }}>Note: direct browser fetch may fail on some websites due to CORS until desktop/backend fetch is wired.</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: '680px' }}>
        <label>
          Website Profile
          <select
            value={selectedProfileId}
            onChange={(event) => handleProfileSelectionChange(event.target.value)}
            style={{ width: '100%' }}
          >
            {!shouldShowCreateOption && <option value="">Select profile...</option>}
            {matchingProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.domain})
              </option>
            ))}
            {shouldShowCreateOption && (
              <option value={CREATE_PROFILE_OPTION_VALUE}>Create new profile for this domain...</option>
            )}
          </select>
        </label>

        <label>
          Starting URL
          <input
            type="url"
            placeholder="https://example.com/content/chapter-1"
            value={startUrl}
            onChange={(event) => setStartUrl(event.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        <button type="submit" disabled={isSubmitting || profiles.length === 0 || shouldShowCreateOption}>
          {isSubmitting ? 'Running...' : 'Start Crawl Job'}
        </button>
      </form>

      {profiles.length === 0 && (
        <p style={{ color: '#8a4f00' }}>No profiles available. Create one in Profile Manager first.</p>
      )}
      {shouldShowCreateOption && (
        <p style={{ color: '#8a4f00' }}>
          No profile matches <code>{targetHost}</code>. Choose "Create new profile for this domain...".
        </p>
      )}
      {message && <p>{message}</p>}
    </section>
  );
}
