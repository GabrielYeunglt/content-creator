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

export type ExportPageElement = string;

export type ExportPageTemplate = {
  header: ExportPageElement[];
  body: ExportPageElement[];
  footer: ExportPageElement[];
};

export type ExportLayout = {
  disableTableOfContents: boolean;
  coverImageSource: 'metadata.cover' | 'first-image-from-url';
  coverPage: ExportPageTemplate;
  indexPage: ExportPageTemplate;
  contentPage: ExportPageTemplate;
};

export type ExportPipelineOptions = {
  document: CanonicalDocument;
  outputHtmlPath?: string;
  outputPdfPath?: string;
  outputEpubPath?: string;
  outputEpubManifestPath?: string;
  exportLayout?: ExportLayout;
};

const defaultExportLayout: ExportLayout = {
  disableTableOfContents: false,
  coverImageSource: 'metadata.cover',
  coverPage: {
    header: ['document.title'],
    body: ['metadata.list'],
    footer: []
  },
  indexPage: {
    header: ['label.index'],
    body: ['index.chapterList'],
    footer: []
  },
  contentPage: {
    header: ['chapter.title'],
    body: ['chapter.bodyHtml'],
    footer: ['chapter.sourceUrl']
  }
};

type StructuredPage = {
  kind: 'cover' | 'index' | 'content';
  title: string;
  sourceUrl?: string;
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
};

export function renderCanonicalHtml(document: CanonicalDocument, exportLayout?: ExportLayout): string {
  const layout = sanitizeExportLayout(exportLayout);
  const structuredPages = buildStructuredPages(document, layout);

  const pageHtml = structuredPages
    .map((page) => {
      if (page.kind === 'content') {
        return `
        <section data-source-url="${escapeHtml(page.sourceUrl ?? '')}">
          ${page.headerHtml ? `<header class="section-header">${page.headerHtml}</header>` : ''}
          <div class="section-body">${page.bodyHtml}</div>
          ${page.footerHtml ? `<footer class="section-footer">${page.footerHtml}</footer>` : ''}
        </section>
      `;
      }

      return `
      <section>
        ${page.headerHtml ? `<header class="section-header">${page.headerHtml}</header>` : ''}
        <div class="section-body">${page.bodyHtml}</div>
        ${page.footerHtml ? `<footer class="section-footer">${page.footerHtml}</footer>` : ''}
      </section>
    `;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)}</title>
    <style>
      body { font-family: Georgia, serif; margin: 40px auto; max-width: 860px; line-height: 1.55; padding: 0 16px; }
      section { margin: 28px 0; page-break-inside: avoid; border-bottom: 1px solid #eee; padding-bottom: 20px; }
      section:last-of-type { border-bottom: none; }
      .section-header { margin-bottom: 12px; }
      .section-body img { max-width: 100%; height: auto; display: block; }
      .section-footer { margin-top: 12px; color: #666; font-size: 0.9rem; }
      .cc-meta-list, .cc-index-list { margin: 0.5rem 0; padding-left: 1.25rem; }
      .cc-label { color: #666; font-size: 0.95rem; }
      .cc-index-title { font-weight: 700; font-size: 1.1rem; }
    </style>
  </head>
  <body>
    ${pageHtml}
  </body>
</html>`;
}

function buildStructuredPages(document: CanonicalDocument, layout: ExportLayout): StructuredPage[] {
  const pages: StructuredPage[] = [];

  pages.push({
    kind: 'cover',
    title: document.title,
    headerHtml: renderTemplateElements(layout.coverPage.header, document),
    bodyHtml: renderTemplateElements(layout.coverPage.body, document),
    footerHtml: renderTemplateElements(layout.coverPage.footer, document)
  });

  if (!layout.disableTableOfContents) {
    pages.push({
      kind: 'index',
      title: 'Index',
      headerHtml: renderTemplateElements(layout.indexPage.header, document),
      bodyHtml: renderTemplateElements(layout.indexPage.body, document),
      footerHtml: renderTemplateElements(layout.indexPage.footer, document)
    });
  }

  for (const chapter of document.chapters) {
    pages.push({
      kind: 'content',
      title: chapter.title,
      sourceUrl: chapter.sourceUrl,
      headerHtml: renderTemplateElements(layout.contentPage.header, document, chapter),
      bodyHtml: renderTemplateElements(layout.contentPage.body, document, chapter),
      footerHtml: renderTemplateElements(layout.contentPage.footer, document, chapter)
    });
  }

  return pages;
}

function renderTemplateElements(elements: ExportPageElement[], document: CanonicalDocument, chapter?: CanonicalDocument['chapters'][number]): string {
  return elements
    .map((element) => renderElementValue(element, document, chapter))
    .filter((value) => value.trim().length > 0)
    .join('\n');
}

function renderElementValue(element: ExportPageElement, document: CanonicalDocument, chapter?: CanonicalDocument['chapters'][number]): string {
  if (element === 'document.title') {
    return `<h1>${escapeHtml(document.title)}</h1>`;
  }
  if (element === 'document.sourceDomain') {
    return `<p class="cc-label">Source domain: ${escapeHtml(document.sourceDomain)}</p>`;
  }
  if (element === 'document.generatedAt') {
    return `<p class="cc-label">Generated at: ${escapeHtml(document.generatedAt)}</p>`;
  }
  if (element === 'metadata.list') {
    const metadataHtml = Object.entries(document.metadata)
      .map(([key, value]) => `<li><strong>${escapeHtml(toLabel(key))}:</strong> ${escapeHtml(value)}</li>`)
      .join('');
    return metadataHtml ? `<ul class="cc-meta-list">${metadataHtml}</ul>` : '';
  }
  if (element.startsWith('metadata.')) {
    const key = element.slice('metadata.'.length);
    const value = document.metadata[key];
    return value ? `<p><strong>${escapeHtml(toLabel(key))}:</strong> ${escapeHtml(value)}</p>` : '';
  }
  if (element === 'index.chapterList') {
    const items = document.chapters
      .map((chapter, index) => `<li>${index + 1}. ${escapeHtml(chapter.title)}</li>`)
      .join('');
    return `<ol class="cc-index-list">${items}</ol>`;
  }
  if (element === 'chapter.title') {
    return chapter ? `<h2>${escapeHtml(chapter.title)}</h2>` : '';
  }
  if (element === 'chapter.sourceUrl') {
    return chapter ? `<p class="cc-label">Source URL: ${escapeHtml(chapter.sourceUrl)}</p>` : '';
  }
  if (element === 'chapter.bodyHtml') {
    return chapter ? `<div class="chapter-body">${renderChapterBody(chapter.bodyHtml)}</div>` : '';
  }
  if (element.startsWith('chapter.metadata.')) {
    const key = element.slice('chapter.metadata.'.length);
    const value = chapter?.metadata?.[key];
    return value ? `<p><strong>${escapeHtml(toLabel(key))}:</strong> ${escapeHtml(value)}</p>` : '';
  }
  if (element === 'label.index') {
    return '<p class="cc-index-title">Index</p>';
  }

  return '';
}

function sanitizeExportLayout(candidate?: ExportLayout): ExportLayout {
  if (!candidate) {
    return defaultExportLayout;
  }

  return {
    disableTableOfContents: Boolean(candidate.disableTableOfContents),
    coverImageSource: candidate.coverImageSource === 'first-image-from-url' ? 'first-image-from-url' : 'metadata.cover',
    coverPage: sanitizeTemplate(candidate.coverPage, defaultExportLayout.coverPage),
    indexPage: sanitizeTemplate(candidate.indexPage, defaultExportLayout.indexPage),
    contentPage: sanitizeTemplate(candidate.contentPage, defaultExportLayout.contentPage)
  };
}

function sanitizeTemplate(candidate: ExportPageTemplate | undefined, fallback: ExportPageTemplate): ExportPageTemplate {
  return {
    header: sanitizeElements(candidate?.header, fallback.header),
    body: sanitizeElements(candidate?.body, fallback.body),
    footer: sanitizeElements(candidate?.footer, fallback.footer)
  };
}

function sanitizeElements(candidate: unknown, fallback: string[]): string[] {
  if (!Array.isArray(candidate)) {
    return fallback;
  }

  const cleaned = candidate.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return cleaned;
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
  const { document, outputHtmlPath, outputPdfPath, outputEpubPath, outputEpubManifestPath, exportLayout } = options;

  const artifacts: ExportArtifact[] = [];

  if (outputHtmlPath) {
    const html = renderCanonicalHtml(document, exportLayout);
    await writeTextFile(outputHtmlPath, html);
    artifacts.push({ format: 'html', path: outputHtmlPath });
  }

  if (outputPdfPath) {
    await renderPdfFromCanonicalDocument({ document, outputPdfPath, exportLayout });
    artifacts.push({ format: 'pdf', path: outputPdfPath });
  }

  if (outputEpubManifestPath) {
    const manifest = renderEpubLikeManifest(document);
    await writeTextFile(outputEpubManifestPath, manifest);
    artifacts.push({ format: 'epub-manifest', path: outputEpubManifestPath });
  }

  if (outputEpubPath) {
    await renderEpubFromCanonicalDocument({ document, outputEpubPath, exportLayout });
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
  exportLayout?: ExportLayout;
}): Promise<void> {
  const { document, outputPdfPath, exportLayout } = params;

  const html = renderCanonicalHtml(document, exportLayout);
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
  exportLayout?: ExportLayout;
}): Promise<void> {
  const { document, outputEpubPath, exportLayout } = params;

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
        appendChapterTitles?: boolean;
        customOpfTemplate?: string;
        content: Array<{ title: string; data: string; excludeFromToc?: boolean }>;
      },
      output: string
    ) => { promise?: Promise<unknown> };

    const layout = sanitizeExportLayout(exportLayout);
    const structuredPages = buildStructuredPages(document, layout);
    const assetDir = await createEpubAssetDirectory();
    const content = await prepareEpubContent(
      structuredPages.map((page) => ({
        title: page.title,
        bodyHtml: [page.headerHtml, page.bodyHtml, page.footerHtml].filter(Boolean).join('\n')
      })),
      assetDir
    );

    const unresolvedDataUrlCount = content.reduce(
      (count, chapter) => count + (chapter.data.match(/data:image\//gi)?.length ?? 0),
      0
    );
    if (unresolvedDataUrlCount > 0) {
      throw new Error(`EPUB content still contains ${unresolvedDataUrlCount} unresolved data:image URL(s) after asset replacement.`);
    }

    const bookTitle = getMetadataValue(document, ['title', 'name']) || document.title;
    const bookAuthor = getMetadataValue(document, ['author']) || document.sourceDomain;
    const bookPublisher = getMetadataValue(document, ['publisher']);
    const bookSeries = getMetadataValue(document, ['series']);
    const bookDescription = getMetadataValue(document, ['description']);
    const bookLanguage = getMetadataValue(document, ['language']);
    const bookCover = await resolveBookCover(document, layout.coverImageSource, assetDir);

    const instance = new EpubConstructor(
      {
        title: bookTitle,
        author: bookAuthor,
        publisher: bookPublisher,
        cover: bookCover,
        description: bookDescription,
        language: bookLanguage,
        appendChapterTitles: false,
        customOpfTemplate: buildCustomOpfTemplate({ series: bookSeries }),
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

async function resolveBookCover(
  document: CanonicalDocument,
  coverImageSource: ExportLayout['coverImageSource'],
  assetDir: string
): Promise<string | undefined> {
  const maybeDataUrlToPath = async (value: string | undefined): Promise<string | undefined> => {
    if (!value) {
      return undefined;
    }

    if (!/^data:image\//i.test(value)) {
      return value;
    }

    return writeDataImageToAsset(value, assetDir, 'cover');
  };

  if (coverImageSource === 'first-image-from-url') {
    const firstImage = findFirstImageInDocument(document);
    if (firstImage) {
      return maybeDataUrlToPath(firstImage);
    }
  }

  return maybeDataUrlToPath(getMetadataValue(document, ['cover']));
}

function findFirstImageInDocument(document: CanonicalDocument): string | undefined {
  for (const chapter of document.chapters) {
    const body = chapter.bodyHtml ?? '';
    const imageMatch = body.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    if (imageMatch?.[1]) {
      return imageMatch[1];
    }

    if (/^data:image\//i.test(body.trim())) {
      return body.trim();
    }

    const urlMatch = body.trim().match(/^https?:\/\/\S+$/i);
    if (urlMatch?.[0]) {
      return urlMatch[0];
    }
  }

  return undefined;
}

function getMetadataValue(document: CanonicalDocument, candidates: string[]): string | undefined {
  const metadataEntries = Object.entries(document.metadata);

  for (const key of candidates) {
    const direct = document.metadata[key];
    if (direct?.trim()) {
      return direct.trim();
    }

    const lowerKey = key.toLowerCase();
    const matched = metadataEntries.find(([metadataKey, value]) => metadataKey.toLowerCase() === lowerKey && value.trim());
    if (matched) {
      return matched[1].trim();
    }
  }

  return undefined;
}

function buildCustomOpfTemplate(params: { series?: string }): string | undefined {
  if (!params.series) {
    return undefined;
  }

  return `<opf:meta property="belongs-to-collection" id="id-2">${escapeHtml(params.series)}</opf:meta>`;
}


function formatErrorDetails(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return `error=${JSON.stringify(scrubDataUrls(String(error)))}`;
  }

  const errorWithFields = error as {
    message?: string;
    code?: string;
    errno?: number;
    syscall?: string;
    path?: string;
  };

  const details = [
    `errorMessage=${JSON.stringify(scrubDataUrls(errorWithFields.message ?? 'Unknown error'))}`,
    `code=${JSON.stringify(errorWithFields.code ?? null)}`,
    `errno=${JSON.stringify(errorWithFields.errno ?? null)}`,
    `syscall=${JSON.stringify(errorWithFields.syscall ?? null)}`,
    `path=${JSON.stringify(scrubDataUrls(errorWithFields.path ?? null))}`
  ];

  return details.join(' ');
}

function scrubDataUrls(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/data:image\/[a-zA-Z0-9.+-]+(?:;[^,]*)?,[^"'\s)]+/gi, '[data:image omitted]');
}

function toLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function prepareEpubContent(
  chapters: Array<{ title: string; bodyHtml: string }>,
  assetDir: string
): Promise<Array<{ title: string; data: string; excludeFromToc: boolean }>> {
  const cryptoModuleName = 'node:crypto';

  const pathModuleName = 'node:path';
  const fsModuleName = 'node:fs/promises';

  const path = await import(/* @vite-ignore */ pathModuleName);
  const fs = (await import(/* @vite-ignore */ fsModuleName)) as {
    writeFile: (path: string, data: Uint8Array) => Promise<void>;
  };
  const { createHash } = await import(/* @vite-ignore */ cryptoModuleName);

  const mergedHtml = chapters
    .map(
      (chapter) => `
        <section style="page-break-after: always; break-after: page;">
          ${chapter.bodyHtml}
        </section>
      `
    )
    .join('\n');

  const data = await replaceDataImageUrls(mergedHtml, assetDir, 0, createHash, fs, path);

  return [
    {
      title: chapters[0]?.title ?? 'Content',
      data,
      excludeFromToc: false
    }
  ];
}

async function createEpubAssetDirectory(): Promise<string> {
  const osModuleName = 'node:os';
  const pathModuleName = 'node:path';
  const fsModuleName = 'node:fs/promises';
  const cryptoModuleName = 'node:crypto';

  const os = await import(/* @vite-ignore */ osModuleName);
  const path = await import(/* @vite-ignore */ pathModuleName);
  const fs = (await import(/* @vite-ignore */ fsModuleName)) as {
    mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
  };
  const { randomUUID } = await import(/* @vite-ignore */ cryptoModuleName);

  const assetDir = path.join(os.tmpdir(), 'content-creator-epub-assets', randomUUID());
  await fs.mkdir(assetDir, { recursive: true });
  return assetDir;
}

async function writeDataImageToAsset(dataUrl: string, assetDir: string, prefix: string): Promise<string> {
  const cryptoModuleName = 'node:crypto';
  const pathModuleName = 'node:path';
  const fsModuleName = 'node:fs/promises';

  const { createHash } = await import(/* @vite-ignore */ cryptoModuleName);
  const path = await import(/* @vite-ignore */ pathModuleName);
  const fs = (await import(/* @vite-ignore */ fsModuleName)) as {
    writeFile: (path: string, data: Uint8Array) => Promise<void>;
  };

  const parsed = await parseDataImageUrlForEpub(dataUrl);
  if (!parsed) {
    return dataUrl;
  }

  const digest = createHash('sha1').update(dataUrl).digest('hex');
  const fileName = `${prefix}-${digest.slice(0, 10)}.${parsed.extension}`;
  const imagePath = path.join(assetDir, fileName);
  await fs.writeFile(imagePath, parsed.data);
  return imagePath;
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
    const parsed = await parseDataImageUrlForEpub(dataUrl);

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

function parseDataImageUrl(dataUrl: string): { extension: string; data: Uint8Array } | null {
  const match = /^data:image\/([a-zA-Z0-9.+-]+)(;[^,]*)?,([\s\S]+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }

  const extension = normalizeImageExtension(match[1]);
  const metadata = match[2] ?? '';
  const payload = match[3];

  const isBase64 = metadata
    .split(';')
    .map((value) => value.trim().toLowerCase())
    .includes('base64');

  if (isBase64) {
    return { extension, data: decodeBase64ToBytes(payload.replace(/\s+/g, '')) };
  }

  return { extension, data: decodeUriEncodedBytes(payload) };
}

async function parseDataImageUrlForEpub(dataUrl: string): Promise<{ extension: string; data: Uint8Array } | null> {
  const parsed = parseDataImageUrl(dataUrl);
  if (!parsed) {
    return null;
  }

  if (parsed.extension !== 'webp') {
    return parsed;
  }

  return convertWebpDataUrlToJpeg(dataUrl);
}

async function convertWebpDataUrlToJpeg(dataUrl: string): Promise<{ extension: string; data: Uint8Array }> {
  const jpegDataUrl = await convertImageDataUrlWithPlaywright(dataUrl, 'image/jpeg');
  const parsed = parseDataImageUrl(jpegDataUrl);
  if (!parsed) {
    throw new Error('Unable to parse converted JPEG data URL for EPUB export.');
  }

  return {
    extension: 'jpg',
    data: parsed.data
  };
}

async function convertImageDataUrlWithPlaywright(dataUrl: string, targetMimeType: string): Promise<string> {
  const playwrightModuleName = 'playwright';
  const playwrightModule = (await import(/* @vite-ignore */ playwrightModuleName)) as {
    chromium: {
      launch: (opts: { headless: boolean }) => Promise<{
        newPage: () => Promise<{
          evaluate: <T>(fn: (params: { sourceDataUrl: string; mimeType: string }) => Promise<T> | T, params: { sourceDataUrl: string; mimeType: string }) => Promise<T>;
        }>;
        close: () => Promise<void>;
      }>;
    };
  };

  const browser = await playwrightModule.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    return await page.evaluate(
      async ({ sourceDataUrl, mimeType }) => {
        const img = new Image();
        img.decoding = 'sync';
        img.src = sourceDataUrl;
        await img.decode();

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('2D canvas context is unavailable for image conversion.');
        }

        context.drawImage(img, 0, 0);
        return canvas.toDataURL(mimeType, 0.92);
      },
      { sourceDataUrl: dataUrl, mimeType: targetMimeType }
    );
  } finally {
    await browser.close();
  }
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const bufferConstructor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferConstructor) {
    return bufferConstructor.from(value, 'base64');
  }

  const decoder = (globalThis as { atob?: (input: string) => string }).atob;
  if (!decoder) {
    throw new Error('Base64 decoder is unavailable in the current runtime.');
  }

  const binary = decoder(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeUriEncodedBytes(value: string): Uint8Array {
  const decoded = decodeURIComponent(value);
  const encoder = new TextEncoder();
  return encoder.encode(decoded);
}

function normalizeImageExtension(mediaTypePart: string): string {
  const value = mediaTypePart.toLowerCase();

  if (value === 'jpeg') {
    return 'jpg';
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
