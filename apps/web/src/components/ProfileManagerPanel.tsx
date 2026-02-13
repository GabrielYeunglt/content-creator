import { useMemo, useState } from 'react';
import { ProfileEditorForm } from './ProfileEditorForm';
import { ProfileList } from './ProfileList';
import {
  createProfile,
  editProfile,
  profileToDraft,
  readProfiles,
  writeProfiles
} from '../lib/profileStorage';
import { defaultProfileDraft, type ProfileDraft, type WebsiteProfile } from '../types/profile';

type ProfileManagerPanelProps = {
  onProfilesChanged: (profiles: WebsiteProfile[]) => void;
};

type ProfileManagerView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; profileId: string };

export function ProfileManagerPanel({ onProfilesChanged }: ProfileManagerPanelProps) {
  const initialProfiles = useMemo(() => readProfiles(), []);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<ProfileDraft>(defaultProfileDraft);
  const [view, setView] = useState<ProfileManagerView>({ mode: 'list' });
  const [message, setMessage] = useState('');

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
    setDraft(defaultProfileDraft);
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
    const updated = profiles.filter((profile) => profile.id !== profileId);
    persistProfiles(updated);
    setMessage('Profile deleted.');

    if (view.mode === 'edit' && view.profileId === profileId) {
      setView({ mode: 'list' });
      setDraft(defaultProfileDraft);
    }
  }

  function handleSaveCreate() {
    const result = createProfile(draft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    persistProfiles([...profiles, result.profile]);
    setDraft(defaultProfileDraft);
    setView({ mode: 'list' });
    setMessage('Profile created.');
  }

  function handleSaveEdit(profileId: string) {
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
    setDraft(defaultProfileDraft);
    setView({ mode: 'list' });
    setMessage('Profile updated.');
  }

  function handleBackToList() {
    setView({ mode: 'list' });
    setDraft(defaultProfileDraft);
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
