# @content-creator/export-engine

Export utilities for converting a canonical document into artifacts.

## Capabilities

- `renderCanonicalHtml(document)` -> HTML string
- `renderEpubLikeManifest(document)` -> JSON string
- `runExportPipeline(...)` -> writes selected artifact files

## Runtime-backed formats

`runExportPipeline` can produce real files for:

- **PDF** via Playwright (`outputPdfPath`)
- **EPUB** via epub-gen (`outputEpubPath`)

It can also write:

- HTML snapshot (`outputHtmlPath`)
- EPUB-like manifest JSON (`outputEpubManifestPath`)

## Runtime dependencies

Install these in the runtime that executes export pipeline:

```bash
npm i playwright epub-gen
```

## Example

```ts
import { runExportPipeline } from '@content-creator/export-engine';

const artifacts = await runExportPipeline({
  document,
  outputHtmlPath: 'output/book.html',
  outputPdfPath: 'output/book.pdf',
  outputEpubPath: 'output/book.epub',
  outputEpubManifestPath: 'output/book.epub-manifest.json'
});
```
