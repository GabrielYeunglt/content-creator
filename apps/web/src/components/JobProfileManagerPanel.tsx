import { useMemo, useState } from 'react';
import {
  createJobProfile,
  editJobProfile,
  jobProfileToDraft,
  readJobProfiles,
  writeJobProfiles
} from '../lib/jobProfileStorage';
import { createDefaultJobProfileDraft, type JobProfile, type JobProfileDraft } from '../types/jobProfile';
import type { WebsiteProfile } from '../types/profile';

type Props = {
  websiteProfiles: WebsiteProfile[];
  onJobProfilesChanged: (profiles: JobProfile[]) => void;
};

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; profileId: string };

const metadataFields = ['title', 'author', 'chapter', 'publisher', 'series', 'cover', 'language', 'description', 'other'] as const;
const fileNameMetadataOptions = [...metadataFields, 'sourceDomain'];

export function JobProfileManagerPanel({ websiteProfiles, onJobProfilesChanged }: Props) {
  const initialJobProfiles = useMemo(() => readJobProfiles(), []);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>(initialJobProfiles);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [draft, setDraft] = useState<JobProfileDraft>(createDefaultJobProfileDraft());
  const [message, setMessage] = useState('');
  const [selectedFileNameMetadata, setSelectedFileNameMetadata] = useState(fileNameMetadataOptions[0]);

  function persist(updated: JobProfile[]) {
    setJobProfiles(updated);
    writeJobProfiles(updated);
    onJobProfilesChanged(updated);
  }

  function updateDraft<K extends keyof JobProfileDraft>(key: K, value: JobProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveCreate() {
    if (!window.confirm('Create this job profile?')) return;
    const result = createJobProfile(draft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    persist([...jobProfiles, result.profile]);
    setDraft(createDefaultJobProfileDraft());
    setView({ mode: 'list' });
    setMessage('Job profile created.');
  }

  function saveEdit(profileId: string) {
    if (!window.confirm('Save changes to this job profile?')) return;
    const target = jobProfiles.find((profile) => profile.id === profileId);
    if (!target) {
      setMessage('Job profile not found.');
      return;
    }

    const result = editJobProfile(target, draft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    persist(jobProfiles.map((profile) => (profile.id === profileId ? result.profile : profile)));
    setDraft(createDefaultJobProfileDraft());
    setView({ mode: 'list' });
    setMessage('Job profile updated.');
  }

  function deleteProfile(profileId: string) {
    if (!window.confirm('Delete this job profile? This cannot be undone.')) return;
    persist(jobProfiles.filter((profile) => profile.id !== profileId));
    setMessage('Job profile deleted.');
  }

  function addMetadataTokenToFileName() {
    updateDraft(
      'exportFileNameTemplate',
      `${draft.exportFileNameTemplate}{{metadata.${selectedFileNameMetadata}}}`
    );
  }

  return (
    <section>
      <h2>Job Profile Manager</h2>
      <p>Manage job-specific overrides for a selected website profile.</p>
      {message && <p>{message}</p>}

      {view.mode === 'list' && (
        <div>
          <button type="button" onClick={() => { setDraft(createDefaultJobProfileDraft()); setView({ mode: 'create' }); }}>
            Create Job Profile
          </button>
          {jobProfiles.length === 0 && <p>No job profiles yet.</p>}
          {jobProfiles.map((profile) => (
            <article key={profile.id} style={{ border: '1px solid #ddd', padding: '0.75rem', marginTop: '0.75rem' }}>
              <p><strong>{profile.name}</strong></p>
              <p>Base profile: <code>{websiteProfiles.find((p) => p.id === profile.baseProfileId)?.name ?? profile.baseProfileId}</code></p>
              <p>Metadata overrides: {Object.values(profile.metadataOverrides ?? {}).filter((v) => Boolean(v?.trim())).length}</p>
              <p>Export destination: <code>{profile.exportDestination ?? 'desktop-artifacts'}</code></p>
              <p>File name format: <code>{profile.exportFileNameTemplate ?? '{{job.id}}-{{date}}'}</code></p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setDraft(jobProfileToDraft(profile)); setView({ mode: 'edit', profileId: profile.id }); }}>
                  Edit
                </button>
                <button type="button" onClick={() => deleteProfile(profile.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {view.mode !== 'list' && (
        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '600px' }}>
          <label>Job Profile Name
            <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} style={{ width: '100%' }} />
          </label>
          <label>Base Website Profile
            <select value={draft.baseProfileId} onChange={(event) => updateDraft('baseProfileId', event.target.value)} style={{ width: '100%' }}>
              <option value="">Select profile...</option>
              {websiteProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name} ({profile.domain})</option>
              ))}
            </select>
          </label>
          <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
            <legend>Rule Overrides (optional)</legend>
            <label>Content selector override
              <input value={draft.contentSelectorOverride} onChange={(event) => updateDraft('contentSelectorOverride', event.target.value)} style={{ width: '100%' }} />
            </label>
            <label>Pagination selector override
              <input value={draft.paginationSelectorOverride} onChange={(event) => updateDraft('paginationSelectorOverride', event.target.value)} style={{ width: '100%' }} />
            </label>
            <label>Total-pages selector override
              <input value={draft.totalPagesSelectorOverride} onChange={(event) => updateDraft('totalPagesSelectorOverride', event.target.value)} style={{ width: '100%' }} />
            </label>
            <label>Max pages override
              <input
                type="number"
                min={1}
                value={draft.maxPagesOverride}
                onChange={(event) => updateDraft('maxPagesOverride', event.target.value ? Number.parseInt(event.target.value, 10) : '')}
              />
            </label>
          </fieldset>
          <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
            <legend>Metadata overrides (optional)</legend>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {metadataFields.map((field) => (
                <label key={field}>{field}
                  <input
                    value={draft.metadataOverrides[field] ?? ''}
                    onChange={(event) => updateDraft('metadataOverrides', { ...draft.metadataOverrides, [field]: event.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
            <legend>Export behavior</legend>
            <label>Export destination
              <select
                value={draft.exportDestination}
                onChange={(event) => updateDraft('exportDestination', event.target.value as JobProfileDraft['exportDestination'])}
                style={{ width: '100%' }}
              >
                <option value="desktop-artifacts">Desktop bridge artifacts folder</option>
                <option value="browser-download">Browser direct download (HTML only fallback)</option>
              </select>
            </label>
            <label>Export file name format
              <input
                value={draft.exportFileNameTemplate}
                onChange={(event) => updateDraft('exportFileNameTemplate', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <select value={selectedFileNameMetadata} onChange={(event) => setSelectedFileNameMetadata(event.target.value)}>
                {fileNameMetadataOptions.map((field) => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
              <button type="button" onClick={addMetadataTokenToFileName}>Add metadata</button>
            </div>
            <p style={{ margin: '0.5rem 0 0' }}>
              Supported tokens: <code>{'{{job.id}} {{date}} {{profile.name}} {{profile.domain}} {{document.title}} {{metadata.key}}'}</code>
            </p>
          </fieldset>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => view.mode === 'create' ? saveCreate() : saveEdit(view.profileId)}>
              {view.mode === 'create' ? 'Create Job Profile' : 'Save Job Profile'}
            </button>
            <button type="button" onClick={() => { setView({ mode: 'list' }); setDraft(createDefaultJobProfileDraft()); }}>
              Back to List
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
