import { useMemo, useState } from 'react';
import { ProfileManagerPanel } from './components/ProfileManagerPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StartJobPanel } from './components/StartJobPanel';
import { readJobs } from './lib/jobStorage';
import { readProfiles } from './lib/profileStorage';
import type { JobRecord } from './types/job';
import type { WebsiteProfile } from './types/profile';

type AppSection = 'start-job' | 'profile-manager' | 'settings' | 'results';

const sections: Array<{ id: AppSection; label: string }> = [
  { id: 'start-job', label: 'Start Job' },
  { id: 'profile-manager', label: 'Profile Manager' },
  { id: 'settings', label: 'Settings' },
  { id: 'results', label: 'Results' }
];

export function App() {
  const initialProfiles = useMemo(() => readProfiles(), []);
  const initialJobs = useMemo(() => readJobs(), []);
  const [activeSection, setActiveSection] = useState<AppSection>('start-job');
  const [profiles, setProfiles] = useState<WebsiteProfile[]>(initialProfiles);
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
<<<<<<< HEAD
  const [createProfileRequestNonce, setCreateProfileRequestNonce] = useState(0);

  function handleRequestCreateProfile() {
    setActiveSection('profile-manager');
    setCreateProfileRequestNonce((current) => current + 1);
  }
=======
>>>>>>> 464c1728549a4b789a601fbd934e9d42b46f818a

  return (
    <main style={{ fontFamily: 'sans-serif', margin: '2rem', maxWidth: '960px' }}>
      <h1>Content Creator</h1>
      <p>V1 Step 6: crawl runner supports multi-page loop with stop rules and domain guard.</p>

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

<<<<<<< HEAD
      {activeSection === 'start-job' && (
        <StartJobPanel
          profiles={profiles}
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
=======
      {activeSection === 'start-job' && <StartJobPanel profiles={profiles} onJobCreated={setJobs} />}
      {activeSection === 'profile-manager' && <ProfileManagerPanel onProfilesChanged={setProfiles} />}
>>>>>>> 464c1728549a4b789a601fbd934e9d42b46f818a
      {activeSection === 'settings' && <SettingsPanel />}
      {activeSection === 'results' && <ResultsPanel jobs={jobs} />}
    </main>
  );
}
