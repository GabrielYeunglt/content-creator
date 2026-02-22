import type { CanonicalDocument } from '../../core/src';

export type ExportFormat = 'pdf' | 'epub' | 'both';

export type ExportRequest = {
  jobId: string;
  format: ExportFormat;
};

export type ExportArtifactFormat = 'html' | 'pdf' | 'epub' | 'epub-manifest';

export type ExportArtifact = {
  format: ExportArtifactFormat;
  path: string;
};

export type ExportPipelineOptions = {
  document: CanonicalDocument;
  outputHtmlPath?: string;
  outputPdfPath?: string;
  outputEpubPath?: string;
  outputEpubManifestPath?: string;
};

export function renderCanonicalHtml(document: CanonicalDocument): string {
  const chapterHtml = document.chapters
    .map(
      (chapter) => {
        const body = renderChapterBody(chapter.bodyHtml);
        return `
        <section data-source-url="${escapeHtml(chapter.sourceUrl)}">
          <h2>${escapeHtml(chapter.title)}</h2>
          <div class="chapter-body">${body}</div>
        </section>
      `
      }
    )
    .join('\n');

  const metadataHtml = Object.entries(document.metadata)
    .map(([key, value]) => `<li><strong>${escapeHtml(toLabel(key))}:</strong> ${escapeHtml(value)}</li>`)
    .join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)}</title>
    <style>
      body { font-family: Georgia, serif; margin: 40px auto; max-width: 860px; line-height: 1.55; padding: 0 16px; }
      h1 { border-bottom: 1px solid #ddd; padding-bottom: 12px; }
      section { margin: 28px 0; page-break-inside: avoid; }
      .chapter-body { margin-top: 12px; }
      .chapter-body img { max-width: 100%; height: auto; display: block; }
      .meta { color: #666; font-size: 0.9rem; }
      .meta-list { color: #444; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(document.title)}</h1>
    <p class="meta">Source domain: ${escapeHtml(document.sourceDomain)}</p>
    <p class="meta">Generated at: ${escapeHtml(document.generatedAt)}</p>
    ${metadataHtml ? `<ul class="meta-list">${metadataHtml}</ul>` : ''}
    ${chapterHtml}
  </body>
</html>`;
}

function renderChapterBody(bodyHtml: string): string {
  const trimmed = bodyHtml.trim();
  if (trimmed.startsWith('data:image/')) {
    return `<img src="${trimmed}" alt="Chapter image" />`;
  }

  if (/^https?:\/\//i.test(trimmed) && /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(trimmed)) {
    return `<img src="${trimmed}" alt="Chapter image" />`;
  }

  return bodyHtml;
}

export function renderEpubLikeManifest(document: CanonicalDocument): string {
  return JSON.stringify(
    {
      id: document.id,
      title: document.title,
      sourceDomain: document.sourceDomain,
      generatedAt: document.generatedAt,
      metadata: document.metadata,
      chapters: document.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        sourceUrl: chapter.sourceUrl,
        bodyHtml: chapter.bodyHtml,
        assets: chapter.assets
      }))
    },
    null,
    2
  );
}

export async function runExportPipeline(options: ExportPipelineOptions): Promise<ExportArtifact[]> {
  const { document, outputHtmlPath, outputPdfPath, outputEpubPath, outputEpubManifestPath } = options;

  const artifacts: ExportArtifact[] = [];

  if (outputHtmlPath) {
    const html = renderCanonicalHtml(document);
    await writeTextFile(outputHtmlPath, html);
    artifacts.push({ format: 'html', path: outputHtmlPath });
  }

  if (outputPdfPath) {
    await renderPdfFromCanonicalDocument({ document, outputPdfPath });
    artifacts.push({ format: 'pdf', path: outputPdfPath });
  }

  if (outputEpubManifestPath) {
    const manifest = renderEpubLikeManifest(document);
    await writeTextFile(outputEpubManifestPath, manifest);
    artifacts.push({ format: 'epub-manifest', path: outputEpubManifestPath });
  }

  if (outputEpubPath) {
    await renderEpubFromCanonicalDocument({ document, outputEpubPath });
    artifacts.push({ format: 'epub', path: outputEpubPath });
  }

  return artifacts;
}

async function writeTextFile(path: string, content: string): Promise<void> {
  const fsModuleName = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ fsModuleName)) as { writeFile: (path: string, content: string, encoding: string) => Promise<void> };
  await fs.writeFile(path, content, 'utf-8');
}

async function renderPdfFromCanonicalDocument(params: {
  document: CanonicalDocument;
  outputPdfPath: string;
}): Promise<void> {
  const { document, outputPdfPath } = params;

  const html = renderCanonicalHtml(document);
  const playwrightModuleName = 'playwright';
  const playwrightModule = (await import(/* @vite-ignore */ playwrightModuleName)) as { chromium: { launch: (opts: { headless: boolean }) => Promise<any> } };

  const browser = await playwrightModule.chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '16mm',
        bottom: '20mm',
        left: '16mm'
      }
    });
  } finally {
    await browser.close();
  }
}

async function renderEpubFromCanonicalDocument(params: {
  document: CanonicalDocument;
  outputEpubPath: string;
}): Promise<void> {
  const { document, outputEpubPath } = params;

  try {
    const epubModuleName = 'epub-gen';
    const EpubConstructor = (await import(/* @vite-ignore */ epubModuleName)).default as new (
      options: {
        title: string;
        author: string;
        publisher?: string;
        cover?: string;
        description?: string;
        language?: string;
        content: Array<{ title: string; data: string }>;
      },
      output: string
    ) => { promise?: Promise<unknown> };

    const content = await prepareEpubContent(document.chapters.map((chapter) => ({
      title: chapter.title,
      bodyHtml: renderChapterBody(chapter.bodyHtml)
    })));

    const unresolvedDataUrlCount = content.reduce(
      (count, chapter) => count + (chapter.data.match(/data:image\//gi)?.length ?? 0),
      0
    );
    if (unresolvedDataUrlCount > 0) {
      throw new Error(`EPUB content still contains ${unresolvedDataUrlCount} unresolved data:image URL(s) after asset replacement.`);
    }

    const instance = new EpubConstructor(
      {
        title: document.title,
        author: document.metadata.author || document.sourceDomain,
        publisher: document.metadata.publisher,
        cover: document.metadata.cover,
        description: document.metadata.description,
        language: document.metadata.language,
        content
      },
      outputEpubPath
    );

    if (instance.promise) {
      await instance.promise;
      return;
    }

    throw new Error('epub-gen did not return a promise; check runtime package version.');
  } catch (error) {
    const enrichedMessage = [
      'EPUB export failed.',
      `documentId=${document.id}`,
      `title=${JSON.stringify(document.title)}`,
      `outputPath=${JSON.stringify(outputEpubPath)}`,
      `chapterCount=${document.chapters.length}`,
      formatErrorDetails(error)
    ].join(' ');
    throw new Error(enrichedMessage);
  }
}


function formatErrorDetails(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return `error=${JSON.stringify(String(error))}`;
  }

  const errorWithFields = error as {
    message?: string;
    code?: string;
    errno?: number;
    syscall?: string;
    path?: string;
  };

  const details = [
    `errorMessage=${JSON.stringify(errorWithFields.message ?? 'Unknown error')}`,
    `code=${JSON.stringify(errorWithFields.code ?? null)}`,
    `errno=${JSON.stringify(errorWithFields.errno ?? null)}`,
    `syscall=${JSON.stringify(errorWithFields.syscall ?? null)}`,
    `path=${JSON.stringify(errorWithFields.path ?? null)}`
  ];

  return details.join(' ');
}

function toLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function prepareEpubContent(
  chapters: Array<{ title: string; bodyHtml: string }>
): Promise<Array<{ title: string; data: string }>> {
  const osModuleName = 'node:os';
  const pathModuleName = 'node:path';
  const fsModuleName = 'node:fs/promises';
  const cryptoModuleName = 'node:crypto';

  const os = await import(/* @vite-ignore */ osModuleName);
  const path = await import(/* @vite-ignore */ pathModuleName);
  const fs = (await import(/* @vite-ignore */ fsModuleName)) as {
    mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
    writeFile: (path: string, data: Uint8Array) => Promise<void>;
  };
  const { createHash, randomUUID } = await import(/* @vite-ignore */ cryptoModuleName);

  const assetDir = path.join(os.tmpdir(), 'content-creator-epub-assets', randomUUID());
  await fs.mkdir(assetDir, { recursive: true });

  return Promise.all(
    chapters.map(async (chapter, chapterIndex) => ({
      title: chapter.title,
      data: await replaceDataImageUrls(chapter.bodyHtml, assetDir, chapterIndex, createHash, fs, path)
    }))
  );
}

async function replaceDataImageUrls(
  html: string,
  assetDir: string,
  chapterIndex: number,
  createHash: (algorithm: string) => { update: (value: string) => { digest: (encoding: 'hex') => string } },
  fs: { writeFile: (path: string, data: Uint8Array) => Promise<void> },
  path: { join: (...paths: string[]) => string }
): Promise<string> {
  const dataImageRegex = /<img\b([^>]*?)\bsrc=["'](data:image\/[^"']+)["']([^>]*?)>/gi;

  let updatedHtml = html;
  let match: RegExpExecArray | null;
  let imageIndex = 0;

  while ((match = dataImageRegex.exec(html)) !== null) {
    const dataUrl = match[2];
    const parsed = parseDataImageUrl(dataUrl);

    if (!parsed) {
      continue;
    }

    const digest = createHash('sha1').update(dataUrl).digest('hex');
    const fileName = `chapter-${chapterIndex + 1}-${imageIndex + 1}-${digest.slice(0, 10)}.${parsed.extension}`;
    imageIndex += 1;
    const imagePath = path.join(assetDir, fileName);

    await fs.writeFile(imagePath, parsed.data);
    updatedHtml = updatedHtml.replace(dataUrl, imagePath);
  }

  return updatedHtml;
}

function parseDataImageUrl(dataUrl: string): { data: Uint8Array; extension: string } | null {
  const match = dataUrl.match(/^data:image\/([\w.+-]+)(?:;[^;,=]+=[^;,]+)*(?:;base64),(.+)$/i);
  if (!match) {
    return null;
  }

  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const nodeBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: 'base64') => Uint8Array } }).Buffer;
  if (!nodeBuffer) {
    return null;
  }

  const bytes = nodeBuffer.from(match[2], 'base64');
  return { data: new Uint8Array(bytes), extension };
}
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
