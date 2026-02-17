const defaultBridgeBaseUrl = 'http://127.0.0.1:8787';
const bridgeBaseUrl = (import.meta as ImportMeta & { env?: { VITE_DESKTOP_BRIDGE_URL?: string } }).env
  ?.VITE_DESKTOP_BRIDGE_URL
  ?? defaultBridgeBaseUrl;

let installedByHttpBridge = false;

async function postJson<TRequest, TResponse>(path: string, payload: TRequest): Promise<TResponse> {
  const response = await fetch(`${bridgeBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Desktop bridge request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as TResponse;
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
