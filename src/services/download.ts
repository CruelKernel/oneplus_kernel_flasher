import type { DownloadProgress } from '../types';

// List of CORS proxies to try in order
const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export async function downloadAsset(
  url: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Blob> {
  let lastError: Error | null = null;

  for (const makeProxyUrl of CORS_PROXIES) {
    const proxiedUrl = makeProxyUrl(url);
    try {
      const response = await fetch(proxiedUrl);
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
      return await downloadWithProgress(response, onProgress);
    } catch (e) {
      lastError = e as Error;
      continue;
    }
  }

  throw new Error(`Download failed: ${lastError?.message || 'All proxies failed'}`);
}

async function downloadWithProgress(
  response: Response,
  onProgress?: (progress: DownloadProgress) => void
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
