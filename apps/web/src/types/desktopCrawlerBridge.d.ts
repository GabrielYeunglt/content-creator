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
<<<<<<< HEAD
      metadataRules?: Array<{
        fieldType: 'title' | 'author' | 'chapter' | 'publisher' | 'series' | 'cover' | 'language' | 'description' | 'other';
        customFieldName?: string;
        selectorType: 'css' | 'xpath';
        selector: string;
        extractMode: 'text' | 'html' | 'attribute';
        attributeName?: string;
        attributeUrlMode?: 'value' | 'fetch-image-data-url';
      }>;
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
      paginationRule: {
        selectorType: 'css' | 'xpath';
        selector: string;
        attributeName: string;
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
      pages: Array<{
        url: string;
        content: string;
<<<<<<< HEAD
        metadata?: Record<string, string>;
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
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
