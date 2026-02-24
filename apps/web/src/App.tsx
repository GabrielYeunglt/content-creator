import { useMemo, useState } from 'react';
import { ExportFormatManagerPanel } from './components/ExportFormatManagerPanel';
import { JobProfileManagerPanel } from './components/JobProfileManagerPanel';
import { ProfileManagerPanel } from './components/ProfileManagerPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StartJobPanel } from './components/StartJobPanel';
import { readJobs } from './lib/jobStorage';
import { readJobProfiles } from './lib/jobProfileStorage';
import { readProfiles } from './lib/profileStorage';
import type { JobProfile } from './types/jobProfile';
import type { JobRecord } from './types/job';
import type { WebsiteProfile } from './types/profile';

type AppSection =
  | 'start-job'
  | 'profile-manager'
  | 'job-profile-manager'
  | 'export-format-manager'
  | 'settings'
  | 'results';

const sections: Array<{ id: AppSection; label: string }> = [
  { id: 'start-job', label: 'Start Job' },
  { id: 'profile-manager', label: 'Profile Manager' },
  { id: 'job-profile-manager', label: 'Job Profile Manager' },
  { id: 'export-format-manager', label: 'Export Format Manager' },
  { id: 'settings', label: 'Settings' },
  { id: 'results', label: 'Results' }
];

export function App() {
  const initialProfiles = useMemo(() => readProfiles(), []);
  const initialJobProfiles = useMemo(() => readJobProfiles(), []);
  const initialJobs = useMemo(() => readJobs(), []);
  const [activeSection, setActiveSection] = useState<AppSection>('start-job');
  const [profiles, setProfiles] = useState<WebsiteProfile[]>(initialProfiles);
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>(initialJobProfiles);
  const [createProfileRequestNonce, setCreateProfileRequestNonce] = useState(0);

  function handleRequestCreateProfile() {
    setActiveSection('profile-manager');
    setCreateProfileRequestNonce((current) => current + 1);
  }

  return (
    <main className="mx-auto my-8 max-w-6xl rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-semibold text-slate-800">Content Creator</h1>
      <p className="mt-2 text-sm text-slate-600">
        V1 Step 9: backend desktop bridge service is available for virtual-browser crawl and runtime exports.
      </p>

      <nav className="mb-6 mt-4 flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              activeSection === section.id
                ? 'border-blue-300 bg-blue-50 text-blue-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === 'start-job' && (
        <StartJobPanel
          profiles={profiles}
          jobProfiles={jobProfiles}
          onJobCreated={setJobs}
          onRequestCreateProfile={handleRequestCreateProfile}
        />
      )}
      {activeSection === 'profile-manager' && (
        <ProfileManagerPanel
          onProfilesChanged={setProfiles}
          createProfileRequestNonce={createProfileRequestNonce}
        />
      )}
      {activeSection === 'settings' && <SettingsPanel />}
      {activeSection === 'export-format-manager' && <ExportFormatManagerPanel jobs={jobs} />}
      {activeSection === 'job-profile-manager' && (
        <JobProfileManagerPanel websiteProfiles={profiles} onJobProfilesChanged={setJobProfiles} />
      )}
      {activeSection === 'results' && <ResultsPanel jobs={jobs} onJobsUpdated={setJobs} />}
    </main>
  );
}
