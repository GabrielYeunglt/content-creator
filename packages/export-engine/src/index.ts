import type { CanonicalDocument } from '../../core/src';

export type ExportFormat = 'pdf' | 'epub' | 'both';

export type ExportRequest = {
  jobId: string;
  format: ExportFormat;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
