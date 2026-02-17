import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildCanonicalDocument } from '../../../packages/core/src/index.ts';
import { crawlWithVirtualBrowser, type VirtualBrowserCrawlOptions } from '../../../packages/crawler-engine/src/index.ts';
import {
  runExportPipeline,
  type ExportArtifact,
  type ExportArtifactFormat
} from '../../../packages/export-engine/src/index.ts';

type ExportRequest = {
  jobId: string;
  format: 'html' | 'pdf' | 'epub' | 'epub-manifest' | 'all';
  pages: Array<{
    url: string;
    preview: string;
    stylesheets?: string[];
    scripts?: string[];
  }>;
  profileName: string;
  profileDomain: string;
};

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
  if (!text) {
    throw new Error('Request body is empty.');
  }

  return JSON.parse(text) as T;
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artifact';
}

function createArtifactPaths(request: ExportRequest): {
  htmlPath?: string;
  pdfPath?: string;
  epubPath?: string;
  epubManifestPath?: string;
} {
  const now = new Date().toISOString().replaceAll(':', '-');
  const baseName = `${sanitizeFilePart(request.jobId)}-${now}`;

  const includeAll = request.format === 'all';
  return {
    htmlPath: includeAll || request.format === 'html' ? join(artifactRoot, `${baseName}.html`) : undefined,
    pdfPath: includeAll || request.format === 'pdf' ? join(artifactRoot, `${baseName}.pdf`) : undefined,
    epubPath: includeAll || request.format === 'epub' ? join(artifactRoot, `${baseName}.epub`) : undefined,
    epubManifestPath:
      includeAll || request.format === 'epub-manifest'
        ? join(artifactRoot, `${baseName}.epub-manifest.json`)
        : undefined
  };
}

function coerceCrawlOptions(value: unknown): VirtualBrowserCrawlOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid crawl request body.');
  }

  return value as VirtualBrowserCrawlOptions;
}

async function handleExport(request: ExportRequest): Promise<{ artifacts: ExportArtifact[] }> {
  await mkdir(artifactRoot, { recursive: true });

  const canonical = buildCanonicalDocument({
    jobId: request.jobId,
    profileName: request.profileName,
    profileDomain: request.profileDomain,
    pages: request.pages.map((page) => ({
      url: page.url,
      preview: page.preview,
      stylesheets: page.stylesheets,
      scripts: page.scripts
    }))
  });

  const paths = createArtifactPaths(request);
  const artifacts = await runExportPipeline({
    document: canonical,
    outputHtmlPath: paths.htmlPath,
    outputPdfPath: paths.pdfPath,
    outputEpubPath: paths.epubPath,
    outputEpubManifestPath: paths.epubManifestPath
  });

  const normalized = artifacts.map((artifact) => ({
    format: artifact.format as ExportArtifactFormat,
    path: artifact.path
  }));

  return { artifacts: normalized };
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Invalid request.' });
    return;
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
    const result = await crawlWithVirtualBrowser(coerceCrawlOptions(body));
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && req.url === '/export') {
    const body = await readJson<ExportRequest>(req);
    const result = await handleExport(body);
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
}

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    sendJson(res, 500, { error: message });
  });
});

server.listen(port, host, () => {
  console.log(`[desktop-bridge] listening on http://${host}:${port}`);
  console.log(`[desktop-bridge] artifacts directory: ${artifactRoot}`);
});
