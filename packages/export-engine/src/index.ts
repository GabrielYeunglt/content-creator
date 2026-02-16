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
      (chapter) => `
        <section data-source-url="${escapeHtml(chapter.sourceUrl)}">
          <h2>${escapeHtml(chapter.title)}</h2>
          <article>${chapter.bodyHtml}</article>
        </section>
      `
    )
    .join('\n');

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
      article { margin-top: 12px; }
      .meta { color: #666; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(document.title)}</h1>
    <p class="meta">Source domain: ${escapeHtml(document.sourceDomain)}</p>
    <p class="meta">Generated at: ${escapeHtml(document.generatedAt)}</p>
    ${chapterHtml}
  </body>
</html>`;
}

export function renderEpubLikeManifest(document: CanonicalDocument): string {
  return JSON.stringify(
    {
      id: document.id,
      title: document.title,
      sourceDomain: document.sourceDomain,
      generatedAt: document.generatedAt,
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
  const fs = (await import(fsModuleName)) as { writeFile: (path: string, content: string, encoding: string) => Promise<void> };
  await fs.writeFile(path, content, 'utf-8');
}

async function renderPdfFromCanonicalDocument(params: {
  document: CanonicalDocument;
  outputPdfPath: string;
}): Promise<void> {
  const { document, outputPdfPath } = params;

  const html = renderCanonicalHtml(document);
  const playwrightModuleName = 'playwright';
  const playwrightModule = (await import(playwrightModuleName)) as { chromium: { launch: (opts: { headless: boolean }) => Promise<any> } };

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
  const EpubConstructor = (await import(epubModuleName)).default as new (
    options: {
      title: string;
      author: string;
      content: Array<{ title: string; data: string }>;
    },
    output: string
  ) => { promise?: Promise<unknown> };

  const content = document.chapters.map((chapter) => ({
    title: chapter.title,
    data: chapter.bodyHtml
  }));

  const instance = new EpubConstructor(
    {
      title: document.title,
      author: document.sourceDomain,
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
