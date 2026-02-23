import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { runCrawlJob } from '../lib/jobRunner';
import { appendJob } from '../lib/jobStorage';
import { readRuntimeBridgeStatus } from '../lib/runtimeBridgeStatus';
import type { JobMode, JobProfile } from '../types/jobProfile';
import type { JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';

const CREATE_PROFILE_OPTION_VALUE = '__create_profile__';

type StartJobPanelProps = {
  profiles: WebsiteProfile[];
  jobProfiles: JobProfile[];
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

export function StartJobPanel({ profiles, jobProfiles, onJobCreated, onRequestCreateProfile }: StartJobPanelProps) {
  const [startUrl, setStartUrl] = useState('');
  const [multiUrlsInput, setMultiUrlsInput] = useState('');
  const [jobMode, setJobMode] = useState<JobMode>('single');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedJobProfileId, setSelectedJobProfileId] = useState('');
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

  const matchingJobProfiles = useMemo(
    () => jobProfiles.filter((profile) => profile.baseProfileId === selectedProfileId),
    [jobProfiles, selectedProfileId]
  );

  const selectedJobProfile = useMemo(
    () => matchingJobProfiles.find((profile) => profile.id === selectedJobProfileId),
    [matchingJobProfiles, selectedJobProfileId]
  );

  useEffect(() => {
    setSelectedJobProfileId((current) => (
      matchingJobProfiles.some((profile) => profile.id === current) ? current : ''
    ));
  }, [matchingJobProfiles]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProfile) {
      setMessage('Please select a profile.');
      return;
    }

    const isMultiUrlMode = jobMode === 'multi';
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

    if (selectedJobProfile?.exportDestination === 'desktop-artifacts' && !runtimeBridgeStatus.exportBridgeReady) {
      setMessage('Selected job profile requires desktop export destination, but export bridge is not connected.');
      return;
    }

    setIsSubmitting(true);

    const queuedJobIds: string[] = [];
    let latestJobs: JobRecord[] | null = null;

    for (const url of urls) {
      const now = new Date().toISOString();
      const newJob: JobRecord = {
        id: crypto.randomUUID(),
        profileId: selectedProfile.id,
        profileName: selectedProfile.name,
        profileDomain: selectedProfile.domain,
        startUrl: url,
        status: 'queued',
        exportDestination: selectedJobProfile?.exportDestination,
        exportFileNameTemplate: selectedJobProfile?.exportFileNameTemplate,
        createdAt: now,
        note: 'Queued for crawl execution.'
      };

      latestJobs = appendJob(newJob);
      queuedJobIds.push(newJob.id);
    }

    if (latestJobs) {
      onJobCreated(latestJobs);
    }

    setMessage(
      queuedJobIds.length === 1
        ? 'Job queued. Running crawl loop...'
        : `${queuedJobIds.length} jobs queued. Running crawl loops...`
    );

    try {
      await Promise.all(
        queuedJobIds.map((jobId, index) => runCrawlJob(jobId, {
          onJobsUpdated: onJobCreated,
          profile: selectedProfile,
          startUrl: urls[index],
          mode: jobMode,
          jobProfile: selectedJobProfile
        }))
      );
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
      <p>Pick a website profile, optionally apply a job profile, then run single or multi URL extraction.</p>
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
          Job Mode
          <select value={jobMode} onChange={(event) => setJobMode(event.target.value as JobMode)} style={{ width: '100%' }}>
            <option value="single">Single URL</option>
            <option value="multi">Multiple URLs</option>
          </select>
        </label>

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
          Job Profile Overrides (optional)
          <select
            value={selectedJobProfileId}
            onChange={(event) => setSelectedJobProfileId(event.target.value)}
            style={{ width: '100%' }}
            disabled={!selectedProfile}
          >
            <option value="">None</option>
            {matchingJobProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </label>

        {jobMode === 'multi' ? (
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
          {isSubmitting ? 'Running...' : jobMode === 'multi' ? 'Start Multi URL Extraction' : 'Start Crawl Job'}
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
