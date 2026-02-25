import { useEffect, useMemo, useState } from 'react';
import { ProfileEditorForm } from './ProfileEditorForm';
import { ProfileList } from './ProfileList';
import {
  createProfile,
  editProfile,
  profileToDraft,
  readProfiles,
  writeProfiles
} from '../lib/profileStorage';
import { createDefaultProfileDraft, type ProfileDraft, type WebsiteProfile } from '../types/profile';

type ProfileManagerPanelProps = {
  onProfilesChanged: (profiles: WebsiteProfile[]) => void;
  createProfileRequestNonce: number;
};

type ProfileManagerView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; profileId: string }
  | { mode: 'details'; profileId: string };

export function ProfileManagerPanel({ onProfilesChanged, createProfileRequestNonce }: ProfileManagerPanelProps) {
  const initialProfiles = useMemo(() => readProfiles(), []);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<ProfileDraft>(createDefaultProfileDraft());
  const [view, setView] = useState<ProfileManagerView>({ mode: 'list' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (createProfileRequestNonce === 0) {
      return;
    }

    setDraft(createDefaultProfileDraft());
    setView({ mode: 'create' });
    setMessage('Create a new profile for the selected domain.');
  }, [createProfileRequestNonce]);

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function persistProfiles(updated: WebsiteProfile[]) {
    setProfiles(updated);
    writeProfiles(updated);
    onProfilesChanged(updated);
  }

  function handleCreateNew() {
    setDraft(createDefaultProfileDraft());
    setView({ mode: 'create' });
    setMessage('');
  }

  function handleViewDetails(profileId: string) {
    setView({ mode: 'details', profileId });
  }

  function handleEdit(profileId: string) {
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) {
      setMessage('Profile not found.');
      return;
    }

    setDraft(profileToDraft(target));
    setView({ mode: 'edit', profileId });
    setMessage(`Editing profile: ${target.name}`);
  }

  function handleDelete(profileId: string) {
    if (!window.confirm('Delete this profile? This cannot be undone.')) {
      return;
    }

    const updated = profiles.filter((profile) => profile.id !== profileId);
    persistProfiles(updated);
    setMessage('Profile deleted.');

    if (view.mode === 'edit' && view.profileId === profileId) {
      setView({ mode: 'list' });
      setDraft(createDefaultProfileDraft());
    }
  }

  function handleSaveCreate() {
    if (!window.confirm('Create this profile with the current values?')) {
      return;
    }

    const result = createProfile(draft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    persistProfiles([...profiles, result.profile]);
    setDraft(createDefaultProfileDraft());
    setView({ mode: 'list' });
    setMessage('Profile created.');
  }

  function handleSaveEdit(profileId: string) {
    if (!window.confirm('Save changes to this profile?')) {
      return;
    }

    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) {
      setMessage('Profile not found.');
      return;
    }

    const result = editProfile(target, draft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const updated = profiles.map((profile) => (profile.id === profileId ? result.profile : profile));
    persistProfiles(updated);
    setDraft(createDefaultProfileDraft());
    setView({ mode: 'list' });
    setMessage('Profile updated.');
  }

  function handleBackToList() {
    setView({ mode: 'list' });
    setDraft(createDefaultProfileDraft());
    setMessage('');
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-sm sm:p-6">
      <header className="space-y-1 border-b border-slate-200 pb-3">
        <h2 className="text-xl font-semibold text-slate-800">Profile Manager</h2>
        <p className="text-sm text-slate-600">Create profile rules by domain with manual CSS/XPath selectors (v1).</p>
      </header>

      {message && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{message}</p>
      )}

      {view.mode === 'list' && (
        <ProfileList
          profiles={profiles}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewDetails={handleViewDetails}
        />
      )}

      {view.mode === 'create' && (
        <ProfileEditorForm
          mode="create"
          draft={draft}
          onChange={updateDraft}
          onSave={handleSaveCreate}
          onCancel={handleBackToList}
        />
      )}


      {view.mode === 'details' && (() => {
        const target = profiles.find((profile) => profile.id === view.profileId);
        if (!target) {
          return <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Profile not found.</p>;
        }

        return (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Profile details</h3>
              <button
                type="button"
                onClick={handleBackToList}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                ← Back to table
              </button>
            </div>

            <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <p><strong className="text-slate-900">Name:</strong> {target.name}</p>
              <p><strong className="text-slate-900">Domain:</strong> {target.domain}</p>
              <p><strong className="text-slate-900">Mode:</strong> {target.profileType ?? 'single-url'}</p>
              <p><strong className="text-slate-900">Wait range:</strong> {target.multiJobWaitSecondsRange?.min ?? 0}s - {target.multiJobWaitSecondsRange?.max ?? 0}s</p>
              <p className="sm:col-span-2"><strong className="text-slate-900">Content selector:</strong> <code className="rounded bg-slate-100 px-1 py-0.5">{target.selectorRules[0]?.selector}</code></p>
              <p className="sm:col-span-2"><strong className="text-slate-900">Pagination:</strong> <code className="rounded bg-slate-100 px-1 py-0.5">{target.paginationRule.selector}</code></p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleEdit(target.id)} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-900">Edit</button>
              <button type="button" onClick={() => handleDelete(target.id)} className="rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-800">Delete</button>
            </div>
          </div>
        );
      })()}

      {view.mode === 'edit' && (
        <ProfileEditorForm
          mode="edit"
          draft={draft}
          onChange={updateDraft}
          onSave={() => handleSaveEdit(view.profileId)}
          onCancel={handleBackToList}
        />
      )}
    </section>
  );
}
