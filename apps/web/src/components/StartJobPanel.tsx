import { useMemo, useState, type FormEvent } from 'react';
import { runSinglePageJob } from '../lib/jobRunner';
import { appendJob } from '../lib/jobStorage';
import type { JobRecord } from '../types/job';
import type { WebsiteProfile } from '../types/profile';

type StartJobPanelProps = {
  profiles: WebsiteProfile[];
  onJobCreated: (jobs: JobRecord[]) => void;
};

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function StartJobPanel({ profiles, onJobCreated }: StartJobPanelProps) {
  const [startUrl, setStartUrl] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      note: 'Queued for single-page fetch/extraction.'
    };

    const queuedJobs = appendJob(newJob);
    onJobCreated(queuedJobs);
    setMessage('Job queued. Running single-page fetch + extraction...');

    try {
      await runSinglePageJob(newJob.id, {
        onJobsUpdated: onJobCreated,
        profile: selectedProfile,
        startUrl: startUrl.trim()
      });
      setMessage('Single-page run finished. Check Results for extracted preview and next URL.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2>Start Job</h2>
      <p>Pick a profile, enter a starting URL, and validate strict in-domain matching.</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: '680px' }}>
        <label>
          Website Profile
          <select
            value={selectedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Select profile...</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.domain})
              </option>
            ))}
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

        <button type="submit" disabled={isSubmitting || profiles.length === 0}>
          {isSubmitting ? 'Running...' : 'Start Single-Page Job'}
        </button>
      </form>

      {profiles.length === 0 && (
        <p style={{ color: '#8a4f00' }}>No profiles available. Create one in Profile Manager first.</p>
      )}
      {message && <p>{message}</p>}
    </section>
  );
}
