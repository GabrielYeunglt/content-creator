import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { runCrawlJob } from '../lib/jobRunner';
import { appendJob } from '../lib/jobStorage';
import { readRuntimeBridgeStatus } from '../lib/runtimeBridgeStatus';
import { exportJobAllViaDesktop, exportJobAsEpub, exportJobAsHtml, exportJobAsPdf } from '../lib/exportActions';
import type { JobMode, JobProfile } from '../types/jobProfile';
import type { JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';
import { JobDetailsCard } from './JobDetailsCard';

const CREATE_PROFILE_OPTION_VALUE = '__create_profile__';
const LAST_JOB_PROFILE_OVERRIDES_KEY = 'content-creator:last-job-profile-overrides:v1';

function readRememberedJobProfileOverrides(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(LAST_JOB_PROFILE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRememberedJobProfileOverrides(value: Record<string, string>): void {
  window.localStorage.setItem(LAST_JOB_PROFILE_OVERRIDES_KEY, JSON.stringify(value));
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type StartJobPanelProps = {
  profiles: WebsiteProfile[];
  jobProfiles: JobProfile[];
  jobs: JobRecord[];
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

export function StartJobPanel({ profiles, jobProfiles, jobs, onJobCreated, onRequestCreateProfile }: StartJobPanelProps) {
  const [startUrl, setStartUrl] = useState('');
  const [multiUrlsInput, setMultiUrlsInput] = useState('');
  const [jobMode, setJobMode] = useState<JobMode>('single');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedJobProfileId, setSelectedJobProfileId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);
  const [rememberedOverrides, setRememberedOverrides] = useState<Record<string, string>>(() => readRememberedJobProfileOverrides());

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

  const currentJob = useMemo(() => {
    const byRecency = (a: JobRecord, b: JobRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    const running = jobs.filter((job) => job.status === 'running').sort(byRecency)[0];
    if (running) return running;

    const queued = jobs.filter((job) => job.status === 'queued').sort(byRecency)[0];
    if (queued) return queued;

    return [...jobs].sort(byRecency)[0] ?? null;
  }, [jobs]);

  async function runExport(job: JobRecord, action: (value: JobRecord) => Promise<JobRecord[] | null>) {
    setExportingJobId(job.id);
    try {
      const updated = await action(job);
      if (updated) onJobCreated(updated);
    } finally {
      setExportingJobId(null);
    }
  }

  useEffect(() => {
    const rememberedForProfile = rememberedOverrides[selectedProfileId] ?? '';
    setSelectedJobProfileId((current) => {
      if (matchingJobProfiles.some((profile) => profile.id === current)) {
        return current;
      }

      if (rememberedForProfile && matchingJobProfiles.some((profile) => profile.id === rememberedForProfile)) {
        return rememberedForProfile;
      }

      return '';
    });
  }, [matchingJobProfiles, rememberedOverrides, selectedProfileId]);

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

    if (selectedJobProfile?.exportDestination !== 'browser-download' && !runtimeBridgeStatus.exportBridgeReady) {
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
      for (let index = 0; index < queuedJobIds.length; index += 1) {
        const jobId = queuedJobIds[index];
        await runCrawlJob(jobId, {
          onJobsUpdated: onJobCreated,
          profile: selectedProfile,
          startUrl: urls[index],
          mode: jobMode,
          jobProfile: selectedJobProfile
        });

        if (jobMode === 'multi' && index < queuedJobIds.length - 1) {
          const minSeconds = Math.max(0, Number(selectedProfile.multiJobWaitSecondsRange?.min) || 0);
          const maxSeconds = Math.max(minSeconds, Number(selectedProfile.multiJobWaitSecondsRange?.max) || minSeconds);
          const waitSeconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
          if (waitSeconds > 0) {
            setMessage(`Waiting ${waitSeconds.toFixed(1)}s before next queued crawl job...`);
            await waitMs(waitSeconds * 1000);
          }
        }
      }
      setMessage('Crawl run finished. Check Results for pages processed, preview, and stop reason.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleJobProfileChange(value: string) {
    setSelectedJobProfileId(value);
    if (!selectedProfileId) {
      return;
    }

    const next = { ...rememberedOverrides, [selectedProfileId]: value };
    setRememberedOverrides(next);
    writeRememberedJobProfileOverrides(next);
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
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Start Job</h2>
        <p className="mt-1 text-sm text-slate-600">Pick a website profile, optionally apply a job profile, then run single or multi URL extraction.</p>
      </div>

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p className={`rounded border px-3 py-2 ${runtimeBridgeStatus.crawlerBridgeReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          Crawl runtime bridge: <strong>{runtimeBridgeStatus.crawlerBridgeReady ? 'connected' : 'not connected'}</strong>
        </p>
        <p className={`rounded border px-3 py-2 ${runtimeBridgeStatus.exportBridgeReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          Export runtime bridge: <strong>{runtimeBridgeStatus.exportBridgeReady ? 'connected' : 'not connected'}</strong>
        </p>
      </div>

      {!runtimeBridgeStatus.crawlerBridgeReady && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Start Job in this build expects a desktop/backend crawl bridge for Playwright execution. If your setup injects the bridge,
          crawling will run; otherwise this standalone app fails fast.
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid max-w-3xl gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="text-sm font-medium text-slate-700">
          Job Mode
          <select value={jobMode} onChange={(event) => setJobMode(event.target.value as JobMode)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="single">Single URL</option>
            <option value="multi">Multiple URLs</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Website Profile
          <select
            value={selectedProfileId}
            onChange={(event) => handleProfileSelectionChange(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
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

        <label className="text-sm font-medium text-slate-700">
          Job Profile Overrides (optional)
          <select
            value={selectedJobProfileId}
            onChange={(event) => handleJobProfileChange(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
            disabled={!selectedProfile}
          >
            <option value="">None</option>
            {matchingJobProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </label>

        {jobMode === 'multi' ? (
          <label className="text-sm font-medium text-slate-700">
            Chapter URLs (comma, newline, or ';' separated)
            <textarea
              placeholder={'https://example.com/chapter-1\nhttps://example.com/chapter-2'}
              value={multiUrlsInput}
              onChange={(event) => setMultiUrlsInput(event.target.value)}
              className="mt-1 min-h-[120px] w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="text-sm font-medium text-slate-700">
            Starting URL
            <input
              type="url"
              placeholder="https://example.com/content/chapter-1"
              value={startUrl}
              onChange={(event) => setStartUrl(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={isSubmitting || profiles.length === 0 || shouldShowCreateOption}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'Running...' : jobMode === 'multi' ? 'Start Multi URL Extraction' : 'Start Crawl Job'}
        </button>
      </form>

      {profiles.length === 0 && (
        <p className="text-sm text-amber-700">No profiles available. Create one in Profile Manager first.</p>
      )}
      {shouldShowCreateOption && (
        <p className="text-sm text-amber-700">
          No profile matches <code>{targetHost}</code>. Choose "Create new profile for this domain...".
        </p>
      )}
      {message && <p className="text-sm text-slate-700">{message}</p>}

      {currentJob && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Current job snapshot</h3>
          <JobDetailsCard
            job={currentJob}
            isExporting={exportingJobId === currentJob.id}
            onExportHtml={(job) => void runExport(job, exportJobAsHtml)}
            onExportPdf={(job) => void runExport(job, exportJobAsPdf)}
            onExportEpub={(job) => void runExport(job, exportJobAsEpub)}
            onExportAll={(job) => void runExport(job, exportJobAllViaDesktop)}
          />
        </div>
      )}
    </section>
  );
}
