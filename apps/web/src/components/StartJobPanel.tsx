import { useMemo, useState, type FormEvent } from 'react';
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

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    const now = new Date().toISOString();
    const newJob: JobRecord = {
      id: crypto.randomUUID(),
      profileId: selectedProfile.id,
      profileName: selectedProfile.name,
      profileDomain: selectedProfile.domain,
      startUrl: startUrl.trim(),
      status: 'completed',
      createdAt: now,
      completedAt: now,
      note: 'V1 scaffold: crawl runner will be connected next.'
    };

    const jobs = appendJob(newJob);
    onJobCreated(jobs);
    setMessage('Job recorded. Next step will execute crawler orchestration.');
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

        <button type="submit">Start (record job)</button>
      </form>

      {profiles.length === 0 && (
        <p style={{ color: '#8a4f00' }}>No profiles available. Create one in Profile Manager first.</p>
      )}
      {message && <p>{message}</p>}
    </section>
  );
}
