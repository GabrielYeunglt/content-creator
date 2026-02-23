import { useMemo, useState } from 'react';
import { clearExportFormatConfig, readExportFormatConfig, writeExportFormatConfig } from '../lib/exportFormatStorage';
import { defaultExportFormatConfig, type ExportFormatConfig, type ExportPageTemplate } from '../types/exportFormat';
import type { JobRecord } from '../types/job';

type PageKey = 'coverPage' | 'indexPage' | 'contentPage';
type SectionKey = 'header' | 'body' | 'footer';
type SaveState = 'idle' | 'saved' | 'reset';

const pageLabels: Record<PageKey, string> = {
  coverPage: 'Cover page',
  indexPage: 'Index page',
  contentPage: 'Content page'
};

const sectionLabels: Record<SectionKey, string> = {
  header: 'Header',
  body: 'Body',
  footer: 'Footer'
};

const baseElementOptions = [
  { value: 'document.title', label: 'Document title' },
  { value: 'document.sourceDomain', label: 'Source domain' },
  { value: 'metadata.list', label: 'All metadata list' },
  { value: 'label.index', label: 'Index label' },
  { value: 'index.chapterList', label: 'Chapter list (index)' },
  { value: 'chapter.title', label: 'Chapter title' },
  { value: 'chapter.bodyHtml', label: 'Chapter body content' },
  { value: 'chapter.sourceUrl', label: 'Chapter source URL' }
];

function addElement(template: ExportPageTemplate, section: SectionKey, element: string): ExportPageTemplate {
  if (!element.trim()) {
    return template;
  }

  return {
    ...template,
    [section]: [...template[section], element]
  };
}

export function ExportFormatManagerPanel({ jobs }: { jobs: JobRecord[] }) {
  const [config, setConfig] = useState<ExportFormatConfig>(() => readExportFormatConfig());
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const metadataElementOptions = useMemo(() => {
    const documentMetadataKeys = new Set<string>();
    const chapterMetadataKeys = new Set<string>();

    for (const job of jobs) {
      for (const [key] of Object.entries(job.consolidatedDocument?.metadata ?? {})) {
        documentMetadataKeys.add(key);
      }

      for (const page of job.extractedPages ?? []) {
        for (const [key] of Object.entries(page.metadata ?? {})) {
          chapterMetadataKeys.add(key);
        }
      }
    }

    return [
      ...Array.from(documentMetadataKeys).sort().map((key) => ({ value: `metadata.${key}`, label: `Document metadata: ${key}` })),
      ...Array.from(chapterMetadataKeys).sort().map((key) => ({ value: `chapter.metadata.${key}`, label: `Chapter metadata: ${key}` }))
    ];
  }, [jobs]);

  const allOptions = [...baseElementOptions, ...metadataElementOptions];

  function updatePageTemplate(page: PageKey, updater: (template: ExportPageTemplate) => ExportPageTemplate) {
    setConfig((current) => ({ ...current, [page]: updater(current[page]) }));
    setSaveState('idle');
  }

  function handleAdd(page: PageKey, section: SectionKey, value: string) {
    updatePageTemplate(page, (template) => addElement(template, section, value));
  }

  function handleRemove(page: PageKey, section: SectionKey, index: number) {
    updatePageTemplate(page, (template) => ({
      ...template,
      [section]: template[section].filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function handleSave() {
    writeExportFormatConfig(config);
    setConfig(readExportFormatConfig());
    setSaveState('saved');
  }

  function handleResetDefault() {
    setConfig(defaultExportFormatConfig);
    setSaveState('idle');
  }

  function handleClearAndFallback() {
    clearExportFormatConfig();
    setConfig(readExportFormatConfig());
    setSaveState('reset');
  }

  return (
    <section>
      <h2>Export Format Manager</h2>
      <p>Configure cover/index/content layouts. Add or remove elements for header, body, and footer.</p>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="checkbox"
          checked={config.disableTableOfContents}
          onChange={(event) => {
            setConfig((current) => ({ ...current, disableTableOfContents: event.target.checked }));
            setSaveState('idle');
          }}
        />
        Disable table of contents page
      </label>

      <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '1rem' }}>
        Cover image source (EPUB)
        <select
          value={config.coverImageSource}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              coverImageSource: event.target.value as ExportFormatConfig['coverImageSource']
            }));
            setSaveState('idle');
          }}
        >
          <option value="metadata.cover">Metadata cover field</option>
          <option value="first-image-from-url">First image extracted from URL content</option>
        </select>
      </label>

      {(Object.keys(pageLabels) as PageKey[]).map((page) => (
        <fieldset key={page} style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem' }}>
          <legend>{pageLabels[page]}</legend>
          {(Object.keys(sectionLabels) as SectionKey[]).map((section) => (
            <div key={`${page}-${section}`} style={{ marginBottom: '0.75rem' }}>
              <strong>{sectionLabels[section]}</strong>
              <ul>
                {config[page][section].map((element, index) => (
                  <li key={`${page}-${section}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code>{element}</code>
                    <button type="button" onClick={() => handleRemove(page, section, index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      return;
                    }
                    handleAdd(page, section, value);
                    event.target.value = '';
                  }}
                >
                  <option value="">Add element…</option>
                  {allOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </fieldset>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleSave}>
          Save export format
        </button>
        <button type="button" onClick={handleResetDefault}>
          Reset form to defaults
        </button>
        <button type="button" onClick={handleClearAndFallback}>
          Clear saved format (use system default)
        </button>
      </div>

      {saveState === 'saved' && <p style={{ color: 'green' }}>Export format saved.</p>}
      {saveState === 'reset' && <p style={{ color: 'green' }}>Saved format cleared. System default will be used.</p>}
    </section>
  );
}
