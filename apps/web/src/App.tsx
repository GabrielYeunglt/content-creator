import { useState } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { StartJobPanel } from './components/StartJobPanel';

type AppSection = 'start-job' | 'profile-manager' | 'settings' | 'results';

const sections: Array<{ id: AppSection; label: string }> = [
  { id: 'start-job', label: 'Start Job' },
  { id: 'profile-manager', label: 'Profile Manager' },
  { id: 'settings', label: 'Settings' },
  { id: 'results', label: 'Results' }
];

function ProfileManagerPlaceholder() {
  return (
    <section>
      <h2>Profile Manager</h2>
      <p>V1 step 1 includes project scaffold + settings. Profile CRUD UI comes next.</p>
    </section>
  );
}

function ResultsPlaceholder() {
  return (
    <section>
      <h2>Results</h2>
      <p>Job history and export artifacts will be implemented after crawler orchestration.</p>
    </section>
  );
}

export function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('start-job');

  return (
    <main style={{ fontFamily: 'sans-serif', margin: '2rem', maxWidth: '960px' }}>
      <h1>Content Creator</h1>
      <p>V1 Step 1: baseline application shell with settings persistence and reset defaults.</p>

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

      {activeSection === 'start-job' && <StartJobPanel />}
      {activeSection === 'profile-manager' && <ProfileManagerPlaceholder />}
      {activeSection === 'settings' && <SettingsPanel />}
      {activeSection === 'results' && <ResultsPlaceholder />}
    </main>
  );
}
