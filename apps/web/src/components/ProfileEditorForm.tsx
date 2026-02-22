import { useState } from 'react';
import { extractFieldFromHtml, extractNextUrlFromHtml } from '../lib/selectorEval';
import {
  type AttributeUrlMode,
  type ExtractMode,
  type MetadataFieldType,
  type ProfileDraft,
  type SelectorType
} from '../types/profile';

type ProfileEditorFormProps = {
  mode: 'create' | 'edit';
  draft: ProfileDraft;
  onChange: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ProfileEditorForm({ mode, draft, onChange, onSave, onCancel }: ProfileEditorFormProps) {
  const [sampleHtml, setSampleHtml] = useState('');
  const [testOutput, setTestOutput] = useState('');

  function handleRunSelectorTest() {
    if (!sampleHtml.trim()) {
      setTestOutput('Paste sample HTML to run selector test.');
      return;
    }

    const contentResult = extractFieldFromHtml({
      html: sampleHtml,
      selectorType: draft.selectorType,
      selector: draft.selector,
      extractMode: draft.extractMode,
      attributeName: draft.contentAttributeName
    });

    const nextResult = extractNextUrlFromHtml({
      html: sampleHtml,
      selectorType: draft.nextSelectorType,
      selector: draft.nextSelector,
      attributeName: draft.nextAttributeName
    });

    const lines = [
      contentResult.ok
        ? `Content selector result: ${contentResult.value || '[empty]'}`
        : `Content selector error: ${contentResult.error}`,
      nextResult.ok
        ? `Next selector result: ${nextResult.value || '[empty]'}`
        : `Next selector error: ${nextResult.error}`
    ];

    setTestOutput(lines.join('\n'));
  }

  function addMetadataRule() {
    onChange('metadataRules', [
      ...draft.metadataRules,
      {
        id: crypto.randomUUID(),
        fieldType: 'title',
        customFieldName: '',
        selectorType: 'css',
        selector: '',
        extractMode: 'text',
        attributeName: 'href',
        attributeUrlMode: 'value'
      }
    ]);
  }

  function updateMetadataRule(index: number, patch: Partial<ProfileDraft['metadataRules'][number]>) {
    onChange(
      'metadataRules',
      draft.metadataRules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule))
    );
  }

  function removeMetadataRule(index: number) {
    onChange(
      'metadataRules',
      draft.metadataRules.filter((_, ruleIndex) => ruleIndex !== index)
    );
  }

  return (
    <section>
      <h3>{mode === 'create' ? 'Create Profile' : 'Edit Profile'}</h3>
      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '520px', marginBottom: '1rem' }}>
        <label>
          Profile Name
          <input value={draft.name} onChange={(event) => onChange('name', event.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Domain
          <input
            placeholder="example.com"
            value={draft.domain}
            onChange={(event) => onChange('domain', event.target.value)}
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
                onChange={(event) => onChange('fieldName', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Selector Type
              <select value={draft.selectorType} onChange={(event) => onChange('selectorType', event.target.value as SelectorType)}>
                <option value="css">CSS</option>
                <option value="xpath">XPath</option>
              </select>
            </label>

            <label>
              Selector
              <input
                value={draft.selector}
                onChange={(event) => onChange('selector', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Extract Mode
              <select value={draft.extractMode} onChange={(event) => onChange('extractMode', event.target.value as ExtractMode)}>
                <option value="text">Text</option>
                <option value="html">HTML</option>
                <option value="attribute">Attribute</option>
              </select>
            </label>

            <label>
              Content Attribute (for attribute mode)
              <input
                value={draft.contentAttributeName}
                onChange={(event) => onChange('contentAttributeName', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Attribute URL Handling
              <select
                value={draft.contentAttributeUrlMode}
                onChange={(event) => onChange('contentAttributeUrlMode', event.target.value as AttributeUrlMode)}
                disabled={draft.extractMode !== 'attribute'}
              >
                <option value="value">Keep URL/value</option>
                <option value="fetch-image-data-url">Fetch image and store as data URL</option>
              </select>
            </label>

            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={draft.required} onChange={(event) => onChange('required', event.target.checked)} />
              Required
            </label>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <legend>Optional Book Metadata Extractions</legend>
          <p style={{ marginTop: 0 }}>
            Add any optional fields (Title, Author, Chapter, Publisher, Series, Cover, etc.) that should flow into EPUB metadata
            and HTML header details.
          </p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {draft.metadataRules.map((rule, index) => (
              <div key={rule.id || `${index}`} style={{ border: '1px solid #eee', padding: '0.5rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label>
                    Field Type
                    <select
                      value={rule.fieldType}
                      onChange={(event) => updateMetadataRule(index, { fieldType: event.target.value as MetadataFieldType })}
                    >
                      <option value="title">Title</option>
                      <option value="author">Author</option>
                      <option value="chapter">Chapter</option>
                      <option value="publisher">Publisher</option>
                      <option value="series">Series</option>
                      <option value="cover">Cover</option>
                      <option value="language">Language</option>
                      <option value="description">Description</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  {rule.fieldType === 'other' && (
                    <label>
                      Custom Field Name
                      <input
                        value={rule.customFieldName}
                        onChange={(event) => updateMetadataRule(index, { customFieldName: event.target.value })}
                        style={{ width: '100%' }}
                      />
                    </label>
                  )}

                  <label>
                    Selector Type
                    <select
                      value={rule.selectorType}
                      onChange={(event) => updateMetadataRule(index, { selectorType: event.target.value as SelectorType })}
                    >
                      <option value="css">CSS</option>
                      <option value="xpath">XPath</option>
                    </select>
                  </label>

                  <label>
                    Selector
                    <input
                      value={rule.selector}
                      onChange={(event) => updateMetadataRule(index, { selector: event.target.value })}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <label>
                    Extract Mode
                    <select
                      value={rule.extractMode}
                      onChange={(event) => updateMetadataRule(index, { extractMode: event.target.value as ExtractMode })}
                    >
                      <option value="text">Text</option>
                      <option value="html">HTML</option>
                      <option value="attribute">Attribute</option>
                    </select>
                  </label>

                  <label>
                    Attribute Name (for attribute mode)
                    <input
                      value={rule.attributeName}
                      onChange={(event) => updateMetadataRule(index, { attributeName: event.target.value })}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <label>
                    Attribute URL Handling
                    <select
                      value={rule.attributeUrlMode}
                      onChange={(event) => updateMetadataRule(index, { attributeUrlMode: event.target.value as AttributeUrlMode })}
                      disabled={rule.extractMode !== 'attribute'}
                    >
                      <option value="value">Keep URL/value</option>
                      <option value="fetch-image-data-url">Fetch image and store as data URL</option>
                    </select>
                  </label>

                  <div>
                    <button type="button" onClick={() => removeMetadataRule(index)}>
                      Remove Metadata Rule
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div>
              <button type="button" onClick={addMetadataRule}>
                Add Metadata Extraction
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <legend>Pagination Rule (Next Button)</legend>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              Selector Type
              <select
                value={draft.nextSelectorType}
                onChange={(event) => onChange('nextSelectorType', event.target.value as SelectorType)}
              >
                <option value="css">CSS</option>
                <option value="xpath">XPath</option>
              </select>
            </label>
            <label>
              Next Selector
              <input
                value={draft.nextSelector}
                onChange={(event) => onChange('nextSelector', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Next Link Attribute
              <input
                value={draft.nextAttributeName}
                onChange={(event) => onChange('nextAttributeName', event.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Max Pages
              <input
                type="number"
                min={1}
                value={draft.maxPages}
                onChange={(event) => onChange('maxPages', Number.parseInt(event.target.value, 10) || 1)}
              />
            </label>
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onSave}>
            {mode === 'create' ? 'Create Profile' : 'Save Profile Changes'}
          </button>
          <button type="button" onClick={onCancel}>
            Back to Profile List
          </button>
        </div>
      </div>

      <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem', marginBottom: '1rem' }}>
        <legend>Selector Test (sample HTML)</legend>
        <p style={{ marginTop: 0 }}>Paste sample page HTML to quickly test current selector inputs.</p>
        <textarea
          value={sampleHtml}
          onChange={(event) => setSampleHtml(event.target.value)}
          style={{ width: '100%', minHeight: '140px', fontFamily: 'monospace' }}
          placeholder="<html>...</html>"
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type="button" onClick={handleRunSelectorTest}>
            Run Selector Test
          </button>
          <button type="button" onClick={() => { setSampleHtml(''); setTestOutput(''); }} style={{ marginLeft: '0.5rem' }}>
            Clear Test
          </button>
        </div>
        {testOutput && (
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: '0.5rem', marginTop: '0.75rem' }}>
            {testOutput}
          </pre>
        )}
      </fieldset>
    </section>
  );
}
