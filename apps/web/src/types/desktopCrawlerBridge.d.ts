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
      };
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
      pages: Array<{
        url: string;
        content: string;
        stylesheets: string[];
        scripts: string[];
      }>;
    }>;
  }
}
