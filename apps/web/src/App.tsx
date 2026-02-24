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
    <main style={{ fontFamily: 'sans-serif', margin: '2rem', maxWidth: '960px' }}>
      <h1>Content Creator</h1>
      <p>V1 Step 9: backend desktop bridge service is available for virtual-browser crawl and runtime exports.</p>

      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            style={{
              border: '1px solid #bbb',
              background: activeSection === section.id ? '#e8f1ff' : 'white',
              padding: '0.5rem 0.75rem'
            }}
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
