export type RuntimeBridgeStatus = {
  crawlerBridgeReady: boolean;
  exportBridgeReady: boolean;
};

export function readRuntimeBridgeStatus(): RuntimeBridgeStatus {
  const crawlerBridgeReady = typeof (window as Window).__CONTENT_CREATOR_DESKTOP_CRAWLER__ === 'function';
  const exportBridgeReady = typeof (window as Window).__CONTENT_CREATOR_DESKTOP_EXPORT__ === 'function';

  return {
    crawlerBridgeReady,
    exportBridgeReady
  };
}
