import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { runCrawlJob } from '../lib/jobRunner';
import { appendJob } from '../lib/jobStorage';
import { readRuntimeBridgeStatus } from '../lib/runtimeBridgeStatus';
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
  const [multiUrlsInput, setMultiUrlsInput] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runtimeBridgeStatus = useMemo(() => readRuntimeBridgeStatus(), []);

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

  const parsedMultiUrls = useMemo(
    () => multiUrlsInput
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean),
    [multiUrlsInput]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProfile) {
      setMessage('Please select a profile.');
      return;
    }

    const isMultiUrlMode = selectedProfile.profileType === 'multi-url';
    const urls = isMultiUrlMode ? parsedMultiUrls : [startUrl.trim()];

    if (urls.length === 0) {
      setMessage(isMultiUrlMode
        ? 'Please provide at least one URL for multi URL extraction.'
        : 'Please provide a valid URL (include http/https).');
      return;
    }

    const invalidUrl = urls.find((url) => !hostFromUrl(url));
    if (invalidUrl) {
      setMessage(`Invalid URL detected: ${invalidUrl}`);
      return;
    }

    const invalidDomainUrl = urls.find((url) => hostFromUrl(url) !== selectedProfile.domain);
    if (invalidDomainUrl) {
      setMessage(
        `Domain mismatch: URL is ${hostFromUrl(invalidDomainUrl)} but selected profile is ${selectedProfile.domain}.`
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
      startUrl: urls[0],
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
        startUrl: urls[0],
        startUrls: urls
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
      <p>Pick a profile, then start a single URL crawl or a multi URL extraction run.</p>
      <p style={{ color: runtimeBridgeStatus.crawlerBridgeReady ? '#1f7a1f' : '#8a4f00' }}>
        Crawl runtime bridge: {runtimeBridgeStatus.crawlerBridgeReady ? 'connected' : 'not connected'}.
      </p>
      <p style={{ color: runtimeBridgeStatus.exportBridgeReady ? '#1f7a1f' : '#8a4f00' }}>
        Export runtime bridge: {runtimeBridgeStatus.exportBridgeReady ? 'connected' : 'not connected'}.
      </p>
      {!runtimeBridgeStatus.crawlerBridgeReady && (
        <p style={{ color: '#8a4f00' }}>
          Start Job in this build expects a desktop/backend crawl bridge for Playwright execution. If your setup injects the bridge,
          crawling will run; otherwise this standalone app fails fast.
        </p>
      )}

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

        {selectedProfile?.profileType === 'multi-url' ? (
          <label>
            Chapter URLs (comma, newline, or ';' separated)
            <textarea
              placeholder={'https://example.com/chapter-1\nhttps://example.com/chapter-2'}
              value={multiUrlsInput}
              onChange={(event) => setMultiUrlsInput(event.target.value)}
              style={{ width: '100%', minHeight: '120px' }}
            />
          </label>
        ) : (
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
        )}

        <button type="submit" disabled={isSubmitting || profiles.length === 0 || shouldShowCreateOption}>
          {isSubmitting ? 'Running...' : selectedProfile?.profileType === 'multi-url' ? 'Start Multi URL Extraction' : 'Start Crawl Job'}
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
