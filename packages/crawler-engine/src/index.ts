export type CrawlStopReason =
  | 'no-next-button'
  | 'already-visited-url'
  | 'max-pages-reached'
  | 'error-threshold-reached';

export type CrawlResult = {
  pagesProcessed: number;
  stopReason: CrawlStopReason;
};
