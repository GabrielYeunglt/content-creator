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
  | { mode: 'edit'; profileId: string };

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
      <h2>Profile Manager</h2>
      <p>Create profile rules by domain with manual CSS/XPath selectors (v1).</p>

      {message && <p>{message}</p>}

      {view.mode === 'list' && (
        <ProfileList
          profiles={profiles}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
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
