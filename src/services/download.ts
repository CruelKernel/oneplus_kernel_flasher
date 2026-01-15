import type { DownloadProgress } from '../types';

// CORS proxy for GitHub release asset downloads
// GitHub assets redirect to S3 which doesn't have CORS headers
const CORS_PROXY = 'https://proxy.corsfix.com/?';

export async function downloadAsset(
  url: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Blob> {
  const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;

  const response = await fetch(proxiedUrl);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    // Fallback for browsers without streaming support
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
