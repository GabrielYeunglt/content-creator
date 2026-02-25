export type CrawlProgressResponse = {
  pagesProcessed: number;
  totalPages?: number;
  currentUrl?: string;
  stage?: 'page-crawled' | 'resolving-next-url' | 'next-url-resolved';
  updatedAt: string;
};

const defaultBridgeBaseUrl = 'http://127.0.0.1:8787';
const bridgeBaseUrl = (import.meta as ImportMeta & { env?: { VITE_DESKTOP_BRIDGE_URL?: string } }).env
  ?.VITE_DESKTOP_BRIDGE_URL
  ?? defaultBridgeBaseUrl;

let installedByHttpBridge = false;

const MAX_ERROR_DETAIL_LENGTH = 600;

function sanitizeErrorDetail(detail: string): string {
  const withoutDataUrls = detail.replace(/data:[^\s"'`)}\]]+/giu, '[data-url-redacted]');
  return withoutDataUrls.length > MAX_ERROR_DETAIL_LENGTH
    ? `${withoutDataUrls.slice(0, MAX_ERROR_DETAIL_LENGTH)}…`
    : withoutDataUrls;
}

async function postJson<TRequest, TResponse>(path: string, payload: TRequest): Promise<TResponse> {
  const response = await fetch(`${bridgeBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = sanitizeErrorDetail(await response.text());
    throw new Error(`Desktop bridge request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as TResponse;
}

export async function stopDesktopCrawl(jobId: string): Promise<void> {
  await postJson('/crawl/stop', { jobId });
}

export async function stopDesktopExport(jobId: string): Promise<void> {
  await postJson('/export/stop', { jobId });
}

export async function fetchDesktopCrawlProgress(jobId: string): Promise<CrawlProgressResponse | null> {
  const response = await fetch(`${bridgeBaseUrl}/crawl/progress?jobId=${encodeURIComponent(jobId)}`, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = sanitizeErrorDetail(await response.text());
    throw new Error(`Desktop bridge progress request failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json()) as { progress?: CrawlProgressResponse };
  return payload.progress ?? null;
}

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${bridgeBaseUrl}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function installBridgeGlobals(): void {
  if (typeof window.__CONTENT_CREATOR_DESKTOP_CRAWLER__ === 'function') {
    return;
  }

  window.__CONTENT_CREATOR_DESKTOP_CRAWLER__ = async (request) =>
    postJson<typeof request, Awaited<ReturnType<NonNullable<typeof window.__CONTENT_CREATOR_DESKTOP_CRAWLER__>>>>(
      '/crawl',
      request
    );

  window.__CONTENT_CREATOR_DESKTOP_EXPORT__ = async (request) =>
    postJson<typeof request, Awaited<ReturnType<NonNullable<typeof window.__CONTENT_CREATOR_DESKTOP_EXPORT__>>>>(
      '/export',
      request
    );

  installedByHttpBridge = true;
}

function removeBridgeGlobals(): void {
  if (!installedByHttpBridge) {
    return;
  }

  delete window.__CONTENT_CREATOR_DESKTOP_CRAWLER__;
  delete window.__CONTENT_CREATOR_DESKTOP_EXPORT__;
  installedByHttpBridge = false;
}

async function syncBridgeAvailability(): Promise<void> {
  const healthy = await checkHealth();

  if (healthy) {
    installBridgeGlobals();
    return;
  }

  removeBridgeGlobals();
}

void syncBridgeAvailability();
window.setInterval(() => {
  void syncBridgeAvailability();
}, 4000);
