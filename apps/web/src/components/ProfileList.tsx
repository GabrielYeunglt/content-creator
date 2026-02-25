import type { WebsiteProfile } from '../types/profile';

type ProfileListProps = {
  profiles: WebsiteProfile[];
  onCreateNew: () => void;
  onEdit: (profileId: string) => void;
  onDelete: (profileId: string) => void;
  onViewDetails: (profileId: string) => void;
};

export function ProfileList({ profiles, onCreateNew, onEdit, onDelete, onViewDetails }: ProfileListProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Saved Profiles ({profiles.length})</h3>
        <button type="button" onClick={onCreateNew} className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">Create New Profile</button>
      </div>

      {profiles.length === 0 && <p className="text-sm text-slate-500">No profiles yet.</p>}
      {profiles.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="table-generic">
            <thead className="bg-slate-50"><tr><th>Name</th><th>Domain</th><th>Mode</th><th>Selectors</th><th>Actions</th></tr></thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="font-medium text-slate-900">{profile.name}</td>
                  <td>{profile.domain}</td>
                  <td>{profile.profileType ?? 'single-url'}</td>
                  <td>{profile.metadataRules?.length ?? 0} metadata / max {profile.stopRules.maxPages}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onViewDetails(profile.id)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100">View details</button>
                      <button type="button" onClick={() => onEdit(profile.id)} className="rounded bg-slate-700 px-2 py-1 text-xs text-white">Edit</button>
                      <button type="button" onClick={() => onDelete(profile.id)} className="rounded bg-rose-700 px-2 py-1 text-xs text-white">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
