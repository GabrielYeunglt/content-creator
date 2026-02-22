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
  const preparedDocument = await inlineImagePayloadsForExport(document);

  const artifacts: ExportArtifact[] = [];

  if (outputHtmlPath) {
    const html = renderCanonicalHtml(preparedDocument);
    await writeTextFile(outputHtmlPath, html);
    artifacts.push({ format: 'html', path: outputHtmlPath });
  }

  if (outputPdfPath) {
    await renderPdfFromCanonicalDocument({ document: preparedDocument, outputPdfPath });
    artifacts.push({ format: 'pdf', path: outputPdfPath });
  }

  if (outputEpubManifestPath) {
    const manifest = renderEpubLikeManifest(preparedDocument);
    await writeTextFile(outputEpubManifestPath, manifest);
    artifacts.push({ format: 'epub-manifest', path: outputEpubManifestPath });
  }

  if (outputEpubPath) {
    await renderEpubFromCanonicalDocument({ document: preparedDocument, outputEpubPath });
    artifacts.push({ format: 'epub', path: outputEpubPath });
  }

  return artifacts;
}

async function inlineImagePayloadsForExport(document: CanonicalDocument): Promise<CanonicalDocument> {
  const chapters = await Promise.all(
    document.chapters.map(async (chapter) => ({
      ...chapter,
      bodyHtml: await inlineStandaloneImageReference(chapter.bodyHtml)
    }))
  );

  const metadata = { ...document.metadata };
  if (metadata.cover) {
    metadata.cover = await inlineStandaloneImageReference(metadata.cover);
  }

  return {
    ...document,
    chapters,
    metadata
  };
}

async function inlineStandaloneImageReference(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return value;
  }

  if (!/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(trimmed)) {
    return value;
  }

  try {
    const response = await fetch(trimmed, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return value;
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return value;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const bufferLike = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
    if (!bufferLike) {
      return value;
    }

    return `data:${contentType};base64,${bufferLike.from(bytes).toString('base64')}`;
  } catch {
    return value;
  }
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

  const content = document.chapters.map((chapter) => ({
    title: chapter.title,
    data: renderChapterBody(chapter.bodyHtml)
  }));

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
}

function toLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
