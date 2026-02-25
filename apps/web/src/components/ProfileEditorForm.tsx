import { useState } from 'react';
import { extractFieldFromHtml, extractNextUrlFromHtml } from '../lib/selectorEval';
import {
  createMetadataExtractionRule,
  createPreExtractionRule,
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

const inputClassName =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200';
const labelClassName = 'text-sm font-medium text-slate-800';
const fieldsetClassName = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm';
const buttonClassName =
  'inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200';

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

  function addPreExtractionRule() {
    onChange('extractionRules', [...draft.extractionRules, createPreExtractionRule()]);
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
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">{mode === 'create' ? 'Create Profile' : 'Edit Profile'}</h3>
      <div className="grid max-w-2xl gap-3">
        <label className={labelClassName}>
          Profile Name
          <input className={inputClassName} value={draft.name} onChange={(event) => onChange('name', event.target.value)} />
        </label>

        <label className={labelClassName}>
          Domain
          <input
            className={inputClassName}
            placeholder="example.com"
            value={draft.domain}
            onChange={(event) => onChange('domain', event.target.value)}
          />
        </label>

        <label className={labelClassName}>
          Profile Mode
          <select
            className={inputClassName}
            value={draft.profileType}
            onChange={(event) => onChange('profileType', event.target.value as 'single-url' | 'multi-url')}
          >
            <option value="single-url">Single URL crawl (existing behavior)</option>
            <option value="multi-url">Multi URL extraction (manual chapter URL list)</option>
          </select>
        </label>

        {draft.profileType === 'multi-url' && (
          <fieldset className={fieldsetClassName}>
            <legend className="px-1 text-sm font-semibold text-slate-800">Multi URL metadata overrides (optional)</legend>
            <p className="text-sm text-slate-600">
              If provided, these values override extracted metadata values in multi URL extraction jobs.
            </p>
            <p className="text-xs text-slate-600">
              EPUB note: <code>series</code> is exported as <code>{'<opf:meta property="belongs-to-collection" id="id-2">...</opf:meta>'}</code>.
            </p>
            <div className="grid gap-2">
              {(['title', 'author', 'volume', 'publisher', 'series', 'subject', 'cover', 'language', 'description', 'other'] as const).map((field) => (
                <label key={field} className={labelClassName}>
                  {field}
                  <input
                    className={inputClassName}
                    value={draft.multiUrlOverrides[field] ?? ''}
                    onChange={(event) => onChange('multiUrlOverrides', {
                      ...draft.multiUrlOverrides,
                      [field]: event.target.value
                    })}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {autoVisibleRules.map((rule) => (
          <fieldset key={rule.id} className={fieldsetClassName}>
            <legend className="px-1 text-sm font-semibold text-slate-800">{rule.label}</legend>
            <div className="grid gap-2">
              {typeof rule.optional === 'boolean' && (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-300"
                    type="checkbox"
                    checked={rule.optional}
                    onChange={(event) => updateExtractionRule(rule.id, { optional: event.target.checked })}
                  />
                  Optional
                </label>
              )}

              {rule.type === 'content' && (
                <label className={labelClassName}>
                  Field Name
                  <input
                    className={inputClassName}
                    value={rule.fieldName ?? ''}
                    onChange={(event) => updateExtractionRule(rule.id, { fieldName: event.target.value })}
                  />
                </label>
              )}

              <label className={labelClassName}>
                Selector Type
                <select
                  className={inputClassName}
                  value={rule.selectorType}
                  onChange={(event) => updateExtractionRule(rule.id, { selectorType: event.target.value as SelectorType })}
                >
                  <option value="css">CSS</option>
                  <option value="xpath">XPath</option>
                </select>
              </label>

              <label className={labelClassName}>
                Selector
                <input
                  className={inputClassName}
                  value={rule.selector}
                  onChange={(event) => updateExtractionRule(rule.id, { selector: event.target.value })}
                />
              </label>

              {rule.type !== 'pagination' && (
                <label className={labelClassName}>
                  Extract Mode
                  <select
                    className={inputClassName}
                    value={rule.extractMode}
                    onChange={(event) => updateExtractionRule(rule.id, { extractMode: event.target.value as ExtractMode })}
                  >
                    <option value="text">Text</option>
                    <option value="html">HTML</option>
                    <option value="attribute">Attribute</option>
                  </select>
                </label>
              )}

              <label className={labelClassName}>
                Attribute Name
                <input
                  className={inputClassName}
                  value={rule.attributeName}
                  onChange={(event) => updateExtractionRule(rule.id, { attributeName: event.target.value })}
                />
              </label>

              {rule.type !== 'total-pages' && (
                <label className={labelClassName}>
                  Attribute URL Handling
                  <select
                    className={inputClassName}
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
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-300"
                    type="checkbox"
                    checked={rule.required ?? true}
                    onChange={(event) => updateExtractionRule(rule.id, { required: event.target.checked })}
                  />
                  Required
                </label>
              )}

              {rule.type === 'pagination' && (
                <label className={labelClassName}>
                  Pagination Navigation
                  <select
                    className={inputClassName}
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
                <label className={labelClassName}>
                  Wait After Navigation (seconds)
                  <input
                    className={inputClassName}
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

        <fieldset className={fieldsetClassName}>
          <legend className="px-1 text-sm font-semibold text-slate-800">Optional Extraction Rules</legend>
          <p className="text-xs text-slate-600">
            EPUB note: selecting <code>series</code> maps to OPF collection metadata.
          </p>
          <div className="grid gap-3">
            {addableRules.map((rule) => (
              <div key={rule.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2">
                  {rule.type === 'pre-extraction' && (
                    <>
                      <label className={labelClassName}>
                        Action
                        <select
                          className={inputClassName}
                          value={rule.action ?? 'click'}
                          onChange={(event) => updateExtractionRule(rule.id, { action: event.target.value as 'click' })}
                        >
                          <option value="click">Click</option>
                        </select>
                      </label>

                      <label className={labelClassName}>
                        Selector Type
                        <select
                          className={inputClassName}
                          value={rule.selectorType}
                          onChange={(event) => updateExtractionRule(rule.id, { selectorType: event.target.value as SelectorType })}
                        >
                          <option value="css">CSS</option>
                          <option value="xpath">XPath</option>
                        </select>
                      </label>

                      <label className={labelClassName}>
                        Selector
                        <input
                          className={inputClassName}
                          value={rule.selector}
                          onChange={(event) => updateExtractionRule(rule.id, { selector: event.target.value })}
                        />
                      </label>

                      <label className={labelClassName}>
                        Run Action
                        <select
                          className={inputClassName}
                          value={rule.runMode ?? 'every-page'}
                          onChange={(event) => updateExtractionRule(rule.id, { runMode: event.target.value as 'every-page' | 'start-of-job' })}
                        >
                          <option value="every-page">On every crawled page</option>
                          <option value="start-of-job">Only at crawl start (after base URL navigation)</option>
                        </select>
                      </label>

                      <label className={labelClassName}>
                        Timeout (ms)
                        <input
                          className={inputClassName}
                          type="number"
                          min={0}
                          step={100}
                          value={rule.timeoutMs ?? 5000}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            updateExtractionRule(rule.id, { timeoutMs: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 });
                          }}
                        />
                      </label>
                    </>
                  )}

                  {rule.type === 'metadata' && (
                    <>
                      <label className={labelClassName}>
                        Field Type
                        <select
                          className={inputClassName}
                          value={rule.fieldType}
                          onChange={(event) => updateExtractionRule(rule.id, { fieldType: event.target.value as MetadataFieldType })}
                        >
                          <option value="title">Title</option>
                          <option value="author">Author</option>
                          <option value="volume">Volume</option>
                          <option value="chapter">Chapter (legacy)</option>
                          <option value="publisher">Publisher</option>
                          <option value="series">Series</option>
                          <option value="subject">Subject</option>
                          <option value="cover">Cover</option>
                          <option value="language">Language</option>
                          <option value="description">Description</option>
                          <option value="other">Other</option>
                        </select>
                      </label>

                      {rule.fieldType === 'other' && (
                        <label className={labelClassName}>
                          Custom Field Name
                          <input
                            className={inputClassName}
                            value={rule.customFieldName}
                            onChange={(event) => updateExtractionRule(rule.id, { customFieldName: event.target.value })}
                          />
                        </label>
                      )}

                      <label className={labelClassName}>
                        Selector Type
                        <select
                          className={inputClassName}
                          value={rule.selectorType}
                          onChange={(event) => updateExtractionRule(rule.id, { selectorType: event.target.value as SelectorType })}
                        >
                          <option value="css">CSS</option>
                          <option value="xpath">XPath</option>
                        </select>
                      </label>

                      <label className={labelClassName}>
                        Selector
                        <input
                          className={inputClassName}
                          value={rule.selector}
                          onChange={(event) => updateExtractionRule(rule.id, { selector: event.target.value })}
                        />
                      </label>

                      <label className={labelClassName}>
                        Extract Mode
                        <select
                          className={inputClassName}
                          value={rule.extractMode}
                          onChange={(event) => updateExtractionRule(rule.id, { extractMode: event.target.value as ExtractMode })}
                        >
                          <option value="text">Text</option>
                          <option value="html">HTML</option>
                          <option value="attribute">Attribute</option>
                        </select>
                      </label>

                      <label className={labelClassName}>
                        Attribute Name
                        <input
                          className={inputClassName}
                          value={rule.attributeName}
                          onChange={(event) => updateExtractionRule(rule.id, { attributeName: event.target.value })}
                        />
                      </label>

                      <label className={labelClassName}>
                        Attribute URL Handling
                        <select
                          className={inputClassName}
                          value={rule.attributeUrlMode}
                          onChange={(event) => updateExtractionRule(rule.id, { attributeUrlMode: event.target.value as AttributeUrlMode })}
                          disabled={rule.extractMode !== 'attribute'}
                        >
                          <option value="value">Keep URL/value</option>
                          <option value="fetch-image-data-url">Fetch image and store as data URL</option>
                        </select>
                      </label>
                    </>
                  )}

                  <div>
                    <button className={buttonClassName} type="button" onClick={() => removeRule(rule.id)}>
                      Remove Extraction Rule
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button className={buttonClassName} type="button" onClick={addMetadataRule}>
                Add Metadata Rule
              </button>
              <button className={buttonClassName} type="button" onClick={addPreExtractionRule}>
                Add Pre-extraction Action
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset className={fieldsetClassName}>
          <legend className="px-1 text-sm font-semibold text-slate-800">Crawl Limits</legend>
          <div className="grid gap-2">
            <label className={labelClassName}>
              Max Pages
              <input
                className={inputClassName}
                type="number"
                min={1}
                value={draft.maxPages}
                onChange={(event) => onChange('maxPages', Number.parseInt(event.target.value, 10) || 1)}
              />
            </label>
            <label className={labelClassName}>
              Pre-extraction max failures before skipping
              <input
                className={inputClassName}
                type="number"
                min={1}
                value={draft.preExtractionMaxFailures}
                onChange={(event) => onChange('preExtractionMaxFailures', Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
              />
            </label>
            <label className={labelClassName}>
              Multi-job wait min (seconds)
              <input
                className={inputClassName}
                type="number"
                min={0}
                value={draft.multiJobWaitMinSeconds}
                onChange={(event) => onChange('multiJobWaitMinSeconds', Math.max(0, Number.parseFloat(event.target.value) || 0))}
              />
            </label>
            <label className={labelClassName}>
              Multi-job wait max (seconds)
              <input
                className={inputClassName}
                type="number"
                min={0}
                value={draft.multiJobWaitMaxSeconds}
                onChange={(event) => onChange('multiJobWaitMaxSeconds', Math.max(0, Number.parseFloat(event.target.value) || 0))}
              />
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClassName} border-transparent bg-slate-900 text-white hover:bg-slate-800`} type="button" onClick={onSave}>
            {mode === 'create' ? 'Create Profile' : 'Save Profile Changes'}
          </button>
          <button className={buttonClassName} type="button" onClick={onCancel}>
            Back to Profile List
          </button>
        </div>
      </div>

      <fieldset className={`${fieldsetClassName} max-w-4xl`}>
        <legend className="px-1 text-sm font-semibold text-slate-800">Selector Test (sample HTML)</legend>
        <p className="text-sm text-slate-600">Paste sample page HTML to test all configured extraction rules.</p>
        <textarea
          className="mt-1 min-h-36 w-full rounded-md border border-slate-300 bg-slate-950/95 px-3 py-2 font-mono text-xs text-slate-100 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={sampleHtml}
          onChange={(event) => setSampleHtml(event.target.value)}
          placeholder="<html>...</html>"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={buttonClassName} type="button" onClick={handleRunSelectorTest}>
            Run Selector Test
          </button>
          <button
            className={buttonClassName}
            type="button"
            onClick={() => {
              setSampleHtml('');
              setTestOutput('');
            }}
          >
            Clear Test
          </button>
        </div>
        {testOutput && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-slate-800">{testOutput}</pre>
        )}
      </fieldset>
    </section>
  );
}
