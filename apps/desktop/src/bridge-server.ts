import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildCanonicalDocument } from '../../../packages/core/src/index.ts';
import { crawlWithVirtualBrowser, type VirtualBrowserCrawlOptions } from '../../../packages/crawler-engine/src/index.ts';
import {
  runExportPipeline,
  type ExportArtifact,
  type ExportArtifactFormat,
  type ExportLayout
} from '../../../packages/export-engine/src/index.ts';

type ExportRequest = {
  jobId: string;
  format: 'html' | 'pdf' | 'epub' | 'all';
  pages: Array<{
    url: string;
    content?: string;
    preview: string;
    metadata?: Record<string, string>;
    stylesheets?: string[];
    scripts?: string[];
  }>;
  profileName: string;
  profileDomain: string;
  crawlPagesTempFileId?: string;
  exportDestination?: string;
  exportFileNameTemplate?: string;
  exportLayout?: ExportLayout;
};

type CrawlPageRecord = {
  url: string;
  content: string;
  metadata?: Record<string, string>;
  stylesheets: string[];
  scripts: string[];
};

const crawlPayloadDir = join(tmpdir(), 'content-creator-crawl-payloads');

function crawlPayloadPath(fileId: string): string {
  return join(crawlPayloadDir, `${fileId}.json`);
}

async function writeCrawlPagesTempFile(pages: CrawlPageRecord[]): Promise<string> {
  await mkdir(crawlPayloadDir, { recursive: true });
  const id = randomUUID();
  await writeFile(crawlPayloadPath(id), JSON.stringify(pages), 'utf-8');
  return id;
}

async function readCrawlPagesTempFile(fileId: string): Promise<CrawlPageRecord[]> {
  const raw = await readFile(crawlPayloadPath(fileId), 'utf-8');
  return JSON.parse(raw) as CrawlPageRecord[];
}

const port = Number.parseInt(process.env.CONTENT_CREATOR_BRIDGE_PORT ?? '8787', 10);
const host = process.env.CONTENT_CREATOR_BRIDGE_HOST ?? '127.0.0.1';
const artifactRoot = resolve(process.env.CONTENT_CREATOR_ARTIFACTS_DIR ?? '.content-creator-artifacts');

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString('utf-8').trim();
  console.log(`[desktop-bridge] received ${req.method ?? 'UNKNOWN'} ${req.url ?? '<missing-url>'} payload (${text.length} chars)`);
  if (!text) {
    throw new Error('Request body is empty.');
  }

  return JSON.parse(text) as T;
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\-_.]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artifact';
}

function createArtifactPaths(request: ExportRequest, metadata: Record<string, string>, documentTitle: string): {
  htmlPath?: string;
  pdfPath?: string;
  epubPath?: string;
} {
  const baseName = buildExportBaseName(request, metadata, documentTitle);
  const destinationRoot = resolveArtifactRoot(request.exportDestination);

  const includeAll = request.format === 'all';
  return {
    htmlPath: includeAll || request.format === 'html' ? join(destinationRoot, `${baseName}.html`) : undefined,
    pdfPath: includeAll || request.format === 'pdf' ? join(destinationRoot, `${baseName}.pdf`) : undefined,
    epubPath: includeAll || request.format === 'epub' ? join(destinationRoot, `${baseName}.epub`) : undefined
  };
}

function resolveArtifactRoot(exportDestination?: string): string {
  const trimmed = exportDestination?.trim();
  if (!trimmed || trimmed === 'desktop-artifacts' || trimmed === 'browser-download') {
    return artifactRoot;
  }

  return resolve(trimmed);
}

function buildExportBaseName(request: ExportRequest, metadata: Record<string, string>, documentTitle: string): string {
  const template = request.exportFileNameTemplate?.trim() || '{{job.id}}-{{date}}';
  const now = new Date().toISOString().replaceAll(':', '-');

  const rendered = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, tokenRaw: string) => {
    const token = tokenRaw.trim();
    if (token === 'job.id') return request.jobId;
    if (token === 'date') return now;
    if (token === 'profile.name') return request.profileName;
    if (token === 'profile.domain') return request.profileDomain;
    if (token === 'document.title') return documentTitle;
    if (token.startsWith('metadata.')) {
      return metadata[token.slice('metadata.'.length)] ?? '';
    }
    return '';
  });

  return sanitizeFilePart(rendered) || `${sanitizeFilePart(request.jobId)}-${now}`;
}

function coerceCrawlOptions(value: unknown): VirtualBrowserCrawlOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid crawl request body.');
  }

  return value as VirtualBrowserCrawlOptions;
}

async function handleExport(request: ExportRequest): Promise<{ artifacts: ExportArtifact[] }> {
  console.log(
    `[desktop-bridge] preparing export for job=${request.jobId} format=${request.format} pages=${request.pages.length}`
  );
  const canonical = buildCanonicalDocument({
    jobId: request.jobId,
    profileName: request.profileName,
    profileDomain: request.profileDomain,
    pages: request.pages.map((page) => ({
      url: page.url,
      content: page.content,
      preview: page.preview,
      metadata: page.metadata,
      stylesheets: page.stylesheets,
      scripts: page.scripts
    }))
  });

  const paths = createArtifactPaths(request, canonical.metadata, canonical.title);
  const directories = new Set(
    [paths.htmlPath, paths.pdfPath, paths.epubPath]
      .filter((value): value is string => Boolean(value))
      .map((outputPath) => dirname(outputPath))
  );
  await Promise.all(Array.from(directories).map((directoryPath) => mkdir(directoryPath, { recursive: true })));
  console.log(
    `[desktop-bridge] export output paths html=${paths.htmlPath ?? 'n/a'} pdf=${paths.pdfPath ?? 'n/a'} epub=${paths.epubPath ?? 'n/a'}`
  );
  if (request.format === 'epub' || request.format === 'all') {
    console.log(
      `[desktop-bridge] epub diagnostics job=${request.jobId} metadataKeys=${Object.keys(canonical.metadata).join(',') || 'none'} chapterCount=${canonical.chapters.length}`
    );
  }
  const artifacts = await runExportPipeline({
    document: canonical,
    outputHtmlPath: paths.htmlPath,
    outputPdfPath: paths.pdfPath,
    outputEpubPath: paths.epubPath,
    exportLayout: request.exportLayout
  });

  const normalized = artifacts.map((artifact) => ({
    format: artifact.format as ExportArtifactFormat,
    path: artifact.path
  }));

  return { artifacts: normalized };
}

async function resolveExportPages(request: ExportRequest): Promise<ExportRequest['pages']> {
  const hasAnyInlineContent = request.pages.some((page) => Boolean(page.content?.trim()));

  if (!request.crawlPagesTempFileId) {
    return request.pages;
  }

  const fromTemp = await readCrawlPagesTempFile(request.crawlPagesTempFileId);
  const mappedFromTemp = fromTemp.map((page) => ({
    url: page.url,
    content: page.content,
    preview: page.content.slice(0, 240),
    metadata: page.metadata,
    stylesheets: page.stylesheets,
    scripts: page.scripts
  }));

  if (!hasAnyInlineContent) {
    return mappedFromTemp;
  }

  const tempByUrl = new Map(mappedFromTemp.map((page) => [page.url, page]));
  return request.pages.map((page) => {
    if (page.content?.trim()) {
      return page;
    }

    const fallback = tempByUrl.get(page.url);
    if (!fallback) {
      return page;
    }

    return {
      ...page,
      content: fallback.content,
      preview: page.preview || fallback.preview,
      metadata: page.metadata ?? fallback.metadata,
      stylesheets: (page.stylesheets?.length ?? 0) > 0 ? page.stylesheets : fallback.stylesheets,
      scripts: (page.scripts?.length ?? 0) > 0 ? page.scripts : fallback.scripts
    };
  });
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Invalid request.' });
    return;
  }

  if (!(req.method === 'GET' && req.url === '/health')) {
    console.log(`[desktop-bridge] request start ${req.method} ${req.url}`);
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, service: 'content-creator-desktop-bridge' });
    return;
  }

  if (req.method === 'POST' && req.url === '/crawl') {
    const body = await readJson<unknown>(req);
    console.log('[desktop-bridge] running crawl request');
    const result = await crawlWithVirtualBrowser(coerceCrawlOptions(body));
    const crawlPagesTempFileId = await writeCrawlPagesTempFile(result.pages as CrawlPageRecord[]);
    console.log(
      `[desktop-bridge] crawl completed pages=${result.pages.length} errors=${result.errors.length} notes=${result.notes.length} tempFile=${crawlPagesTempFileId}`
    );
    sendJson(res, 200, {
      ...result,
      crawlPagesTempFileId
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/export') {
    const body = await readJson<ExportRequest>(req);
    const resolvedPages = await resolveExportPages(body);
    console.log(`[desktop-bridge] running export request for job=${body.jobId}`);
    const result = await handleExport({
      ...body,
      pages: resolvedPages
    });
    console.log(`[desktop-bridge] export completed artifacts=${result.artifacts.length}`);
    sendJson(res, 200, result);
    return;
  }

  console.warn(`[desktop-bridge] route not found ${req.method} ${req.url}`);
  sendJson(res, 404, { error: 'Not found.' });
}

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    console.error(`[desktop-bridge] request failed ${req.method ?? 'UNKNOWN'} ${req.url ?? '<missing-url>'}: ${message}`);
    sendJson(res, 500, { error: message });
  });
});

server.listen(port, host, () => {
  console.log(`[desktop-bridge] listening on http://${host}:${port}`);
  console.log(`[desktop-bridge] artifacts directory: ${artifactRoot}`);
});
