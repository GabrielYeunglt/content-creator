import { defaultAppSettings, type AppSettings } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'content-creator:settings:v1';

function normalizeNumericValue(value: number, fallback: number): number {
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return fallback;
}

export function sanitizeSettings(candidate: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    outputDir:
      typeof candidate?.outputDir === 'string' && candidate.outputDir.trim().length > 0
        ? candidate.outputDir.trim()
        : defaultAppSettings.outputDir,
    maxPagesDefault: normalizeNumericValue(candidate?.maxPagesDefault ?? NaN, defaultAppSettings.maxPagesDefault),
    requestTimeoutMs: normalizeNumericValue(candidate?.requestTimeoutMs ?? NaN, defaultAppSettings.requestTimeoutMs),
    delayMsBetweenPages: normalizeNumericValue(candidate?.delayMsBetweenPages ?? NaN, defaultAppSettings.delayMsBetweenPages),
    strictDomainOnly:
      typeof candidate?.strictDomainOnly === 'boolean'
        ? candidate.strictDomainOnly
        : defaultAppSettings.strictDomainOnly,
    defaultExportFormat:
      candidate?.defaultExportFormat === 'pdf' ||
      candidate?.defaultExportFormat === 'epub' ||
      candidate?.defaultExportFormat === 'both'
        ? candidate.defaultExportFormat
        : defaultAppSettings.defaultExportFormat
  };
}

export function readSettings(): AppSettings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (!raw) {
    return defaultAppSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return sanitizeSettings(parsed);
  } catch {
    return defaultAppSettings;
  }
}

export function writeSettings(settings: AppSettings): void {
  const sanitized = sanitizeSettings(settings);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
}

export function resetSettings(): AppSettings {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultAppSettings));
  return defaultAppSettings;
}
