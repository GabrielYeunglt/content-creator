import type { WebsiteProfile } from '../types/profile';

type ProfileListProps = {
  profiles: WebsiteProfile[];
  onCreateNew: () => void;
  onEdit: (profileId: string) => void;
  onDelete: (profileId: string) => void;
};

export function ProfileList({ profiles, onCreateNew, onEdit, onDelete }: ProfileListProps) {
  return (
    <section>
      <h3>Saved Profiles ({profiles.length})</h3>
      <button type="button" onClick={onCreateNew} style={{ marginBottom: '0.75rem' }}>
        Create New Profile
      </button>

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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => onEdit(profile.id)}>
              Edit
            </button>
            <button type="button" onClick={() => onDelete(profile.id)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
