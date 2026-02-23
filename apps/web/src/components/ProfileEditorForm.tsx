import { useState } from 'react';
import { extractFieldFromHtml, extractNextUrlFromHtml } from '../lib/selectorEval';
import {
  createMetadataExtractionRule,
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

  function updateExtractionRule(ruleId: string, patch: Partial<ProfileDraft['extractionRules'][number]>) {
    onChange(
      'extractionRules',
      draft.extractionRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule))
    );
  }

  function addMetadataRule() {
    onChange('extractionRules', [...draft.extractionRules, createMetadataExtractionRule()]);
  }

  function removeRule(ruleId: string) {
    if (!window.confirm('Remove this extraction rule?')) {
      return;
    }

    onChange(
      'extractionRules',
      draft.extractionRules.filter((rule) => rule.id !== ruleId)
    );
  }

  function handleRunSelectorTest() {
    if (!sampleHtml.trim()) {
      setTestOutput('Paste sample HTML to run selector test.');
      return;
    }

    const lines = draft.extractionRules
      .filter((rule) => rule.selector.trim())
      .map((rule) => {
        if (rule.type === 'pagination') {
          const nextResult = extractNextUrlFromHtml({
            html: sampleHtml,
            selectorType: rule.selectorType,
            selector: rule.selector,
            attributeName: rule.attributeName
          });

          return nextResult.ok
            ? `${rule.label}: ${nextResult.value || '[empty]'}`
            : `${rule.label} error: ${nextResult.error}`;
        }

        const extracted = extractFieldFromHtml({
          html: sampleHtml,
          selectorType: rule.selectorType,
          selector: rule.selector,
          extractMode: rule.extractMode,
          attributeName: rule.attributeName
        });

        return extracted.ok
          ? `${rule.label}: ${extracted.value || '[empty]'}`
          : `${rule.label} error: ${extracted.error}`;
      });

    setTestOutput(lines.length ? lines.join('\n') : 'No selectors configured to test.');
  }

  const autoVisibleRules = draft.extractionRules.filter((rule) => rule.showByDefault);
  const addableRules = draft.extractionRules.filter((rule) => !rule.showByDefault);

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

        {autoVisibleRules.map((rule) => (
          <fieldset key={rule.id} style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
            <legend>{rule.label}</legend>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {typeof rule.optional === 'boolean' && (
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={rule.optional}
                    onChange={(event) => updateExtractionRule(rule.id, { optional: event.target.checked })}
                  />
                  Optional
                </label>
              )}

              {rule.type === 'content' && (
                <label>
                  Field Name
                  <input
                    value={rule.fieldName ?? ''}
                    onChange={(event) => updateExtractionRule(rule.id, { fieldName: event.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              )}

              <label>
                Selector Type
                <select
                  value={rule.selectorType}
                  onChange={(event) => updateExtractionRule(rule.id, { selectorType: event.target.value as SelectorType })}
                >
                  <option value="css">CSS</option>
                  <option value="xpath">XPath</option>
                </select>
              </label>

              <label>
                Selector
                <input
                  value={rule.selector}
                  onChange={(event) => updateExtractionRule(rule.id, { selector: event.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              {rule.type !== 'pagination' && (
                <label>
                  Extract Mode
                  <select
                    value={rule.extractMode}
                    onChange={(event) => updateExtractionRule(rule.id, { extractMode: event.target.value as ExtractMode })}
                  >
                    <option value="text">Text</option>
                    <option value="html">HTML</option>
                    <option value="attribute">Attribute</option>
                  </select>
                </label>
              )}

              <label>
                Attribute Name
                <input
                  value={rule.attributeName}
                  onChange={(event) => updateExtractionRule(rule.id, { attributeName: event.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              {rule.type !== 'total-pages' && (
                <label>
                  Attribute URL Handling
                  <select
                    value={rule.attributeUrlMode}
                    onChange={(event) => updateExtractionRule(rule.id, { attributeUrlMode: event.target.value as AttributeUrlMode })}
                    disabled={rule.extractMode !== 'attribute'}
                  >
                    <option value="value">Keep URL/value</option>
                    <option value="fetch-image-data-url">Fetch image and store as data URL</option>
                  </select>
                </label>
              )}

              {rule.type === 'content' && (
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={rule.required ?? true}
                    onChange={(event) => updateExtractionRule(rule.id, { required: event.target.checked })}
                  />
                  Required
                </label>
              )}

              {rule.type === 'pagination' && (
                <label>
                  Pagination Navigation
                  <select
                    value={rule.navigationMode ?? 'url-attribute'}
                    onChange={(event) => updateExtractionRule(rule.id, { navigationMode: event.target.value as 'url-attribute' | 'click' | 'url-pattern' })}
                  >
                    <option value="url-attribute">Extract next URL from attribute</option>
                    <option value="click">Click next button (JS-driven)</option>
                    <option value="url-pattern">Build next URL from current page (#p=next)</option>
                  </select>
                </label>
              )}


              {rule.type === 'pagination' && (
                <label>
                  Wait After Navigation (seconds)
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={rule.postNavigationDelaySeconds ?? 0.5}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      updateExtractionRule(rule.id, {
                        postNavigationDelaySeconds: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
                      });
                    }}
                  />
                </label>
              )}
            </div>
          </fieldset>
        ))}

        <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <legend>Optional Extraction Rules</legend>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {addableRules.map((rule) => (
              <div key={rule.id} style={{ border: '1px solid #eee', padding: '0.5rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label>
                    Field Type
                    <select
                      value={rule.fieldType}
                      onChange={(event) => updateExtractionRule(rule.id, { fieldType: event.target.value as MetadataFieldType })}
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
                        onChange={(event) => updateExtractionRule(rule.id, { customFieldName: event.target.value })}
                        style={{ width: '100%' }}
                      />
                    </label>
                  )}

                  <label>
                    Selector Type
                    <select
                      value={rule.selectorType}
                      onChange={(event) => updateExtractionRule(rule.id, { selectorType: event.target.value as SelectorType })}
                    >
                      <option value="css">CSS</option>
                      <option value="xpath">XPath</option>
                    </select>
                  </label>

                  <label>
                    Selector
                    <input
                      value={rule.selector}
                      onChange={(event) => updateExtractionRule(rule.id, { selector: event.target.value })}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <label>
                    Extract Mode
                    <select
                      value={rule.extractMode}
                      onChange={(event) => updateExtractionRule(rule.id, { extractMode: event.target.value as ExtractMode })}
                    >
                      <option value="text">Text</option>
                      <option value="html">HTML</option>
                      <option value="attribute">Attribute</option>
                    </select>
                  </label>

                  <label>
                    Attribute Name
                    <input
                      value={rule.attributeName}
                      onChange={(event) => updateExtractionRule(rule.id, { attributeName: event.target.value })}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <label>
                    Attribute URL Handling
                    <select
                      value={rule.attributeUrlMode}
                      onChange={(event) => updateExtractionRule(rule.id, { attributeUrlMode: event.target.value as AttributeUrlMode })}
                      disabled={rule.extractMode !== 'attribute'}
                    >
                      <option value="value">Keep URL/value</option>
                      <option value="fetch-image-data-url">Fetch image and store as data URL</option>
                    </select>
                  </label>

                  <div>
                    <button type="button" onClick={() => removeRule(rule.id)}>
                      Remove Extraction Rule
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div>
              <button type="button" onClick={addMetadataRule}>
                Add Extraction Rule
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <legend>Crawl Limits</legend>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
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
        <p style={{ marginTop: 0 }}>Paste sample page HTML to test all configured extraction rules.</p>
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
