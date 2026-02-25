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
    <section>
      <h2 className="text-xl font-semibold text-slate-800">Profile Manager</h2>
      <p className="mt-1 text-sm text-slate-600">Create profile rules by domain with manual CSS/XPath selectors (v1).</p>

      {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}

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
          return <p className="mt-3 text-sm text-rose-700">Profile not found.</p>;
        }

        return (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <button type="button" onClick={handleBackToList} className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-100">← Back to table</button>
            <div className="grid gap-1 text-sm text-slate-700">
              <p><strong>Name:</strong> {target.name}</p>
              <p><strong>Domain:</strong> {target.domain}</p>
              <p><strong>Mode:</strong> {target.profileType ?? 'single-url'}</p>
              <p><strong>Content selector:</strong> <code>{target.selectorRules[0]?.selector}</code></p>
              <p><strong>Pagination:</strong> <code>{target.paginationRule.selector}</code></p>
              <p><strong>Wait range:</strong> {target.multiJobWaitSecondsRange?.min ?? 0}s - {target.multiJobWaitSecondsRange?.max ?? 0}s</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleEdit(target.id)} className="rounded bg-slate-700 px-3 py-1 text-xs text-white">Edit</button>
              <button type="button" onClick={() => handleDelete(target.id)} className="rounded bg-rose-700 px-3 py-1 text-xs text-white">Delete</button>
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
