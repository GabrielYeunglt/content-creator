import type { ExportFormatConfig } from '../types/exportFormat';
import { defaultExportFormatConfig } from '../types/exportFormat';

const EXPORT_FORMAT_STORAGE_KEY = 'content-creator:export-format:v1';

function sanitizeElements(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const cleaned = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return cleaned;
}

function sanitizeTemplate(value: unknown, fallback: ExportFormatConfig['coverPage']): ExportFormatConfig['coverPage'] {
  const candidate = value && typeof value === 'object' ? (value as Partial<ExportFormatConfig['coverPage']>) : undefined;

  return {
    header: sanitizeElements(candidate?.header, fallback.header),
    body: sanitizeElements(candidate?.body, fallback.body),
    footer: sanitizeElements(candidate?.footer, fallback.footer)
  };
}

export function sanitizeExportFormatConfig(value: unknown): ExportFormatConfig {
  const candidate = value && typeof value === 'object' ? (value as Partial<ExportFormatConfig>) : undefined;

  return {
    skipIndexPage: Boolean(candidate?.skipIndexPage),
    coverPage: sanitizeTemplate(candidate?.coverPage, defaultExportFormatConfig.coverPage),
    indexPage: sanitizeTemplate(candidate?.indexPage, defaultExportFormatConfig.indexPage),
    contentPage: sanitizeTemplate(candidate?.contentPage, defaultExportFormatConfig.contentPage)
  };
}

export function readExportFormatConfig(): ExportFormatConfig {
  const raw = window.localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY);
  if (!raw) {
    return defaultExportFormatConfig;
  }

  try {
    return sanitizeExportFormatConfig(JSON.parse(raw));
  } catch {
    return defaultExportFormatConfig;
  }
}

export function readSavedExportFormatConfig(): ExportFormatConfig | null {
  const raw = window.localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return sanitizeExportFormatConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeExportFormatConfig(config: ExportFormatConfig): void {
  const sanitized = sanitizeExportFormatConfig(config);
  window.localStorage.setItem(EXPORT_FORMAT_STORAGE_KEY, JSON.stringify(sanitized));
}

export function clearExportFormatConfig(): void {
  window.localStorage.removeItem(EXPORT_FORMAT_STORAGE_KEY);
}
