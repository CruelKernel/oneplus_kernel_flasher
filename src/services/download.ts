import type { DownloadProgress } from '../types';

// List of CORS proxies to try in order
const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// How long to wait for response headers before giving up on a proxy.
// The body itself is not subject to this limit, so slow downloads still complete.
const HEADERS_TIMEOUT_MS = 20_000;

export async function downloadAsset(
  url: string,
  expectedSize: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<Blob> {
  let lastError: Error | null = null;

  for (const makeProxyUrl of CORS_PROXIES) {
    try {
      const response = await fetchWithHeadersTimeout(makeProxyUrl(url));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Proxies tend to answer with an HTML error page and a 200 status when the upstream fails
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.startsWith('text/html')) {
        throw new Error('Proxy returned an HTML page instead of the image');
      }

      const blob = await downloadWithProgress(response, onProgress);
      if (expectedSize > 0 && blob.size !== expectedSize) {
        throw new Error(`Unexpected size: got ${blob.size} bytes, expected ${expectedSize}`);
      }
      return blob;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error('All proxies failed');
}

async function fetchWithHeadersTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`No response after ${HEADERS_TIMEOUT_MS / 1000}s`)),
    HEADERS_TIMEOUT_MS,
  );

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function downloadWithProgress(
  response: Response,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<Blob> {
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    return await response.blob();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? (loaded / total) * 100 : 0,
    });
  }

  return new Blob(chunks as BlobPart[]);
}
