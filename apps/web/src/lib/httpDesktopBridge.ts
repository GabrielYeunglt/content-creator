const defaultBridgeBaseUrl = 'http://127.0.0.1:8787';
const bridgeBaseUrl = (import.meta as ImportMeta & { env?: { VITE_DESKTOP_BRIDGE_URL?: string } }).env
  ?.VITE_DESKTOP_BRIDGE_URL
  ?? defaultBridgeBaseUrl;

let installedByHttpBridge = false;

const MAX_ERROR_DETAIL_LENGTH = 600;
const CRAWL_PROGRESS_POLL_INTERVAL_MS = 450;

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

type CrawlProgressPayload = {
  pagesProcessed: number;
  totalPages?: number;
  currentUrl?: string;
  completed: boolean;
};

async function postCrawlWithProgress(
  request: Parameters<NonNullable<typeof window.__CONTENT_CREATOR_DESKTOP_CRAWLER__>>[0]
): Promise<Awaited<ReturnType<NonNullable<typeof window.__CONTENT_CREATOR_DESKTOP_CRAWLER__>>>> {
  const crawlSessionId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let shouldStopPolling = false;
  const onPageCrawled = request.onPageCrawled;

  const pollPromise = (async () => {
    while (!shouldStopPolling) {
      await new Promise((resolve) => window.setTimeout(resolve, CRAWL_PROGRESS_POLL_INTERVAL_MS));
      if (shouldStopPolling) {
        break;
      }

      try {
        const progressResponse = await fetch(`${bridgeBaseUrl}/crawl-progress?sessionId=${encodeURIComponent(crawlSessionId)}`, {
          method: 'GET'
        });
        if (!progressResponse.ok) {
          continue;
        }

        const progressBody = await progressResponse.json() as { progress?: CrawlProgressPayload | null };
        const progress = progressBody.progress;
        if (progress && onPageCrawled) {
          onPageCrawled({
            pagesProcessed: progress.pagesProcessed,
            totalPages: progress.totalPages,
            currentUrl: progress.currentUrl
          });
        }
      } catch {
        // Ignore polling hiccups to avoid interrupting crawls.
      }
    }
  })();

  try {
    const { onPageCrawled: _unusedOnPageCrawled, ...serializableRequest } = request;
    return await postJson<typeof serializableRequest & { crawlSessionId: string }, Awaited<ReturnType<NonNullable<typeof window.__CONTENT_CREATOR_DESKTOP_CRAWLER__>>>>(
      '/crawl',
      {
        ...serializableRequest,
        crawlSessionId
      }
    );
  } finally {
    shouldStopPolling = true;
    await pollPromise;
  }
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

  window.__CONTENT_CREATOR_DESKTOP_CRAWLER__ = async (request) => postCrawlWithProgress(request);

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
