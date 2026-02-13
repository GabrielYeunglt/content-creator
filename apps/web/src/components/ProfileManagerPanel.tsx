import { useMemo, useState } from 'react';
import { createProfile, readProfiles, writeProfiles } from '../lib/profileStorage';
import { defaultProfileDraft, type ExtractMode, type ProfileDraft, type SelectorType } from '../types/profile';

export function ProfileManagerPanel() {
  const initialProfiles = useMemo(() => readProfiles(), []);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<ProfileDraft>(defaultProfileDraft);
  const [message, setMessage] = useState('');

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function handleCreateProfile() {
    const result = createProfile(draft);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const updated = [...profiles, result.profile];
    setProfiles(updated);
    writeProfiles(updated);
    setDraft(defaultProfileDraft);
    setMessage('Profile created.');
  }

  function handleDeleteProfile(profileId: string) {
    const updated = profiles.filter((profile) => profile.id !== profileId);
    setProfiles(updated);
    writeProfiles(updated);
    setMessage('Profile deleted.');
  }

  return (
    <section>
      <h2>Profile Manager</h2>
      <p>Create profile rules by domain with manual CSS/XPath selectors (v1).</p>

      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '520px', marginBottom: '1rem' }}>
        <label>
          Profile Name
          <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Domain
          <input
            placeholder="example.com"
            value={draft.domain}
            onChange={(event) => updateDraft('domain', event.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <legend>Primary Content Selector</legend>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              Field Name
              <input
                value={draft.fieldName}
                onChange={(event) => updateDraft('fieldName', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Selector Type
              <select
                value={draft.selectorType}
                onChange={(event) => updateDraft('selectorType', event.target.value as SelectorType)}
              >
                <option value="css">CSS</option>
                <option value="xpath">XPath</option>
              </select>
            </label>

            <label>
              Selector
              <input
                value={draft.selector}
                onChange={(event) => updateDraft('selector', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Extract Mode
              <select
                value={draft.extractMode}
                onChange={(event) => updateDraft('extractMode', event.target.value as ExtractMode)}
              >
                <option value="text">Text</option>
                <option value="html">HTML</option>
                <option value="attribute">Attribute</option>
              </select>
            </label>

            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(event) => updateDraft('required', event.target.checked)}
              />
              Required
            </label>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <legend>Pagination Rule (Next Button)</legend>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              Selector Type
              <select
                value={draft.nextSelectorType}
                onChange={(event) => updateDraft('nextSelectorType', event.target.value as SelectorType)}
              >
                <option value="css">CSS</option>
                <option value="xpath">XPath</option>
              </select>
            </label>
            <label>
              Next Selector
              <input
                value={draft.nextSelector}
                onChange={(event) => updateDraft('nextSelector', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Next Link Attribute
              <input
                value={draft.nextAttributeName}
                onChange={(event) => updateDraft('nextAttributeName', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Max Pages
              <input
                type="number"
                min={1}
                value={draft.maxPages}
                onChange={(event) => updateDraft('maxPages', Number.parseInt(event.target.value, 10) || 1)}
              />
            </label>
          </div>
        </fieldset>

        <button type="button" onClick={handleCreateProfile}>
          Create Profile
        </button>
      </div>

      {message && <p>{message}</p>}

      <h3>Saved Profiles ({profiles.length})</h3>
      {profiles.length === 0 && <p>No profiles yet.</p>}
      {profiles.map((profile) => (
        <article key={profile.id} style={{ border: '1px solid #ddd', padding: '0.75rem', marginBottom: '0.75rem' }}>
          <p>
            <strong>{profile.name}</strong> — {profile.domain}
          </p>
          <p>
            Content selector: <code>{profile.selectorRules[0]?.selectorType}</code> <code>{profile.selectorRules[0]?.selector}</code>
          </p>
          <p>
            Next selector: <code>{profile.paginationRule.selectorType}</code> <code>{profile.paginationRule.selector}</code>
          </p>
          <button type="button" onClick={() => handleDeleteProfile(profile.id)}>
            Delete
          </button>
        </article>
      ))}
    </section>
  );
}
