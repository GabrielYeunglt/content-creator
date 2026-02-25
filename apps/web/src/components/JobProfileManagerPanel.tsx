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

type View = { mode: 'list' } | { mode: 'details'; profileId: string } | { mode: 'create' } | { mode: 'edit'; profileId: string };
const metadataFields = ['title', 'author', 'volume', 'publisher', 'series', 'subject', 'cover', 'language', 'description', 'other'] as const;

export function JobProfileManagerPanel({ websiteProfiles, onJobProfilesChanged }: Props) {
  const initialJobProfiles = useMemo(() => readJobProfiles(), []);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>(initialJobProfiles);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [draft, setDraft] = useState<JobProfileDraft>(createDefaultJobProfileDraft());
  const [message, setMessage] = useState('');

  function persist(updated: JobProfile[]) { setJobProfiles(updated); writeJobProfiles(updated); onJobProfilesChanged(updated); }
  function updateDraft<K extends keyof JobProfileDraft>(key: K, value: JobProfileDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function saveCreate() { const result = createJobProfile(draft); if (!result.ok) return setMessage(result.error); persist([...jobProfiles, result.profile]); setView({ mode: 'list' }); setDraft(createDefaultJobProfileDraft()); }
  function saveEdit(profileId: string) { const target = jobProfiles.find((profile) => profile.id === profileId); if (!target) return setMessage('Job profile not found.'); const result = editJobProfile(target, draft); if (!result.ok) return setMessage(result.error); persist(jobProfiles.map((p) => p.id === profileId ? result.profile : p)); setView({ mode: 'list' }); }
  function deleteProfile(profileId: string) { if (!window.confirm('Delete this job profile?')) return; persist(jobProfiles.filter((profile) => profile.id !== profileId)); }

  const detailProfile = view.mode === 'details' ? jobProfiles.find((profile) => profile.id === view.profileId) : null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-800">Job Profile Manager</h2>
      <p className="text-sm text-slate-600">Manage job-specific overrides for a selected website profile.</p>
      {message && <p className="text-sm text-slate-700">{message}</p>}

      {view.mode === 'list' && (
        <>
          <button type="button" onClick={() => { setDraft(createDefaultJobProfileDraft()); setView({ mode: 'create' }); }} className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white">Create Job Profile</button>
          {jobProfiles.length === 0 && <p className="text-sm text-slate-500">No job profiles yet.</p>}
          {jobProfiles.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="table-generic">
                <thead className="bg-slate-50"><tr><th>Name</th><th>Base profile</th><th>Export</th><th>Metadata overrides</th><th>Actions</th></tr></thead>
                <tbody>
                  {jobProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="font-medium text-slate-900">{profile.name}</td>
                      <td>{websiteProfiles.find((p) => p.id === profile.baseProfileId)?.name ?? profile.baseProfileId}</td>
                      <td>{profile.exportDestination?.trim() || 'desktop-artifacts'}</td>
                      <td>{Object.values(profile.metadataOverrides ?? {}).filter((v) => Boolean(v?.trim())).length}</td>
                      <td><div className="flex gap-2"><button type="button" onClick={() => setView({ mode: 'details', profileId: profile.id })} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">View details</button><button type="button" onClick={() => { setDraft(jobProfileToDraft(profile)); setView({ mode: 'edit', profileId: profile.id }); }} className="rounded bg-slate-700 px-2 py-1 text-xs text-white">Edit</button><button type="button" onClick={() => deleteProfile(profile.id)} className="rounded bg-rose-700 px-2 py-1 text-xs text-white">Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {detailProfile && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <button type="button" onClick={() => setView({ mode: 'list' })} className="rounded border border-slate-300 bg-white px-3 py-1 text-xs">← Back to table</button>
          <p><strong>Name:</strong> {detailProfile.name}</p><p><strong>Base profile:</strong> {websiteProfiles.find((p) => p.id === detailProfile.baseProfileId)?.name ?? detailProfile.baseProfileId}</p>
          <p><strong>Export destination:</strong> {detailProfile.exportDestination || 'desktop-artifacts'}</p><p><strong>File template:</strong> <code>{detailProfile.exportFileNameTemplate || '{{job.id}}-{{date}}'}</code></p>
        </div>
      )}

      {(view.mode === 'create' || view.mode === 'edit') && (
        <div className="grid max-w-3xl gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <label>Job Profile Name<input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <label>Base Website Profile<select value={draft.baseProfileId} onChange={(event) => updateDraft('baseProfileId', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2"><option value="">Select profile...</option>{websiteProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} ({profile.domain})</option>)}</select></label>
          <label>Content selector override<input value={draft.contentSelectorOverride} onChange={(event) => updateDraft('contentSelectorOverride', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <label>Pagination selector override<input value={draft.paginationSelectorOverride} onChange={(event) => updateDraft('paginationSelectorOverride', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <label>Total-pages selector override<input value={draft.totalPagesSelectorOverride} onChange={(event) => updateDraft('totalPagesSelectorOverride', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <label>Max pages override<input type="number" min={1} value={draft.maxPagesOverride} onChange={(event) => updateDraft('maxPagesOverride', event.target.value ? Number.parseInt(event.target.value, 10) : '')} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <fieldset className="rounded border border-slate-300 p-3"><legend className="px-1 text-xs">Metadata overrides</legend><div className="grid gap-2">{metadataFields.map((field) => <label key={field}>{field}<input value={draft.metadataOverrides[field] ?? ''} onChange={(event) => updateDraft('metadataOverrides', { ...draft.metadataOverrides, [field]: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>)}</div></fieldset>
          <label>Export destination<input type="text" value={draft.exportDestination} onChange={(event) => updateDraft('exportDestination', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <label>Export file name format<input value={draft.exportFileNameTemplate} onChange={(event) => updateDraft('exportFileNameTemplate', event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>
          <div className="flex gap-2"><button type="button" onClick={() => view.mode === 'create' ? saveCreate() : saveEdit(view.profileId)} className="rounded bg-blue-700 px-3 py-2 text-xs font-medium text-white">{view.mode === 'create' ? 'Create Job Profile' : 'Save Job Profile'}</button><button type="button" onClick={() => setView({ mode: 'list' })} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs">Back to table</button></div>
        </div>
      )}
    </section>
  );
}
