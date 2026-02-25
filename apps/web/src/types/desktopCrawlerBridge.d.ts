export {};

declare global {
  interface Window {
    __CONTENT_CREATOR_DESKTOP_CRAWLER__?: (request: {
      jobId?: string;
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
        fieldType: 'title' | 'author' | 'volume' | 'chapter' | 'publisher' | 'series' | 'cover' | 'language' | 'description' | 'other';
        customFieldName?: string;
        selectorType: 'css' | 'xpath';
        selector: string;
        extractMode: 'text' | 'html' | 'attribute';
        attributeName?: string;
        attributeUrlMode?: 'value' | 'fetch-image-data-url';
      }>;
      preExtractionRules?: Array<{
        selectorType: 'css' | 'xpath';
        selector: string;
        action: 'click';
        runMode?: 'every-page' | 'start-of-job';
        timeoutMs?: number;
      }>;
      preExtractionMaxFailures?: number;
      paginationRule: {
        selectorType: 'css' | 'xpath';
        selector: string;
        attributeName: string;
        navigationMode?: 'url-attribute' | 'click' | 'url-pattern';
        postNavigationDelaySeconds?: number;
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
      onPageCrawled?: (payload: {
        pagesProcessed: number;
        totalPages?: number;
        currentUrl?: string;
        stage?: 'page-crawled' | 'resolving-next-url' | 'next-url-resolved';
      }) => void;
    }) => Promise<{
      pagesProcessed: number;
      stopReason: string;
      crawlPagesTempFileId?: string;
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
        metadata?: Record<string, string>;
        stylesheets?: string[];
        scripts?: string[];
      }>;
      profileName: string;
      profileDomain: string;
      crawlPagesTempFileId?: string;
      exportDestination?: string;
      exportFileNameTemplate?: string;
      exportLayout?: {
        disableTableOfContents: boolean;
        coverImageSource: 'metadata.cover' | 'first-image-from-url';
        coverPage: { header: string[]; body: string[]; footer: string[] };
        indexPage: { header: string[]; body: string[]; footer: string[] };
        contentPage: { header: string[]; body: string[]; footer: string[] };
      };
    }) => Promise<{
      artifacts: Array<{
        format: 'html' | 'pdf' | 'epub' | 'epub-manifest';
        path: string;
      }>;
    }>;
  }
}
