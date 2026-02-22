export {};

declare global {
  interface Window {
    __CONTENT_CREATOR_DESKTOP_CRAWLER__?: (request: {
      startUrl: string;
      domain: string;
      contentRule: {
        selectorType: 'css' | 'xpath';
        selector: string;
        extractMode: 'text' | 'html' | 'attribute';
        attributeName?: string;
        attributeUrlMode?: 'value' | 'fetch-image-data-url';
      };
      metadataRules?: Array<{
        fieldType: 'title' | 'author' | 'chapter' | 'publisher' | 'series' | 'cover' | 'language' | 'description' | 'other';
        customFieldName?: string;
        selectorType: 'css' | 'xpath';
        selector: string;
        extractMode: 'text' | 'html' | 'attribute';
        attributeName?: string;
        attributeUrlMode?: 'value' | 'fetch-image-data-url';
      }>;
      paginationRule: {
        selectorType: 'css' | 'xpath';
        selector: string;
        attributeName: string;
        navigationMode?: 'url-attribute' | 'click';
      };
      totalPagesRule?: {
        selectorType: 'css' | 'xpath';
        selector: string;
        attributeName?: string;
      };
      stopRules: {
        maxPages: number;
        maxConsecutiveErrors: number;
      };
      contentReadySelector?: {
        selectorType: 'css' | 'xpath';
        selector: string;
        timeoutMs?: number;
      };
    }) => Promise<{
      pagesProcessed: number;
      stopReason: string;
      errors?: Array<{
        url: string;
        attempt: number;
        error: string;
      }>;
      notes?: string[];
      pages: Array<{
        url: string;
        content: string;
        metadata?: Record<string, string>;
        stylesheets: string[];
        scripts: string[];
      }>;
    }>;

    __CONTENT_CREATOR_DESKTOP_EXPORT__?: (request: {
      jobId: string;
      format: 'html' | 'pdf' | 'epub' | 'all';
      pages: Array<{
        url: string;
        content?: string;
        preview: string;
        stylesheets?: string[];
        scripts?: string[];
      }>;
      profileName: string;
      profileDomain: string;
    }) => Promise<{
      artifacts: Array<{
        format: 'html' | 'pdf' | 'epub' | 'epub-manifest';
        path: string;
      }>;
    }>;
  }
}
