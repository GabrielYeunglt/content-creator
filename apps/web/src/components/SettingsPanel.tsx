import { useMemo, useState } from 'react';
import { readSettings, resetSettings, writeSettings } from '../lib/settingsStorage';
import type { AppSettings, ExportFormat } from '../types/settings';

type SaveState = 'idle' | 'saved' | 'reset';

function parseInteger(input: string, fallback: number): number {
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsPanel() {
  const initialSettings = useMemo(() => readSettings(), []);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  function updateField<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveState('idle');
  }

  function handleSave() {
    writeSettings(settings);
    setSettings(readSettings());
    setSaveState('saved');
  }

  function handleReset() {
    const defaults = resetSettings();
    setSettings(defaults);
    setSaveState('reset');
  }

  return (
    <section>
      <h2>Settings</h2>
      <p>Configure scraping defaults, persist them locally, or reset to defaults.</p>

      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '420px' }}>
        <label>
          Output Directory
          <input
            value={settings.outputDir}
            onChange={(event) => updateField('outputDir', event.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Max Pages (default)
          <input
            type="number"
            min={1}
            value={settings.maxPagesDefault}
            onChange={(event) => updateField('maxPagesDefault', parseInteger(event.target.value, 1))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Request Timeout (ms)
          <input
            type="number"
            min={1000}
            value={settings.requestTimeoutMs}
            onChange={(event) => updateField('requestTimeoutMs', parseInteger(event.target.value, 1000))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Delay Between Pages (ms)
          <input
            type="number"
            min={0}
            value={settings.delayMsBetweenPages}
            onChange={(event) => updateField('delayMsBetweenPages', parseInteger(event.target.value, 0))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Default Export Format
          <select
            value={settings.defaultExportFormat}
            onChange={(event) => updateField('defaultExportFormat', event.target.value as ExportFormat)}
            style={{ width: '100%' }}
          >
            <option value="both">PDF + EPUB</option>
            <option value="pdf">PDF</option>
            <option value="epub">EPUB</option>
          </select>
        </label>

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={settings.strictDomainOnly}
            onChange={(event) => updateField('strictDomainOnly', event.target.checked)}
          />
          Strict Domain Only
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" onClick={handleSave}>
          Save Settings
        </button>
        <button type="button" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>

      {saveState === 'saved' && <p style={{ color: 'green' }}>Settings saved.</p>}
      {saveState === 'reset' && <p style={{ color: 'green' }}>Defaults restored.</p>}
    </section>
  );
}
