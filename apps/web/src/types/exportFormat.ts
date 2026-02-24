import type { ExportLayout, ExportPageElement } from '../../../../packages/export-engine/src';

export type ExportPageTemplate = {
  header: ExportPageElement[];
  body: ExportPageElement[];
  footer: ExportPageElement[];
};

export type ExportFormatConfig = ExportLayout;

export const defaultExportFormatConfig: ExportFormatConfig = {
  disableTableOfContents: false,
  disableMetadataPage: false,
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
