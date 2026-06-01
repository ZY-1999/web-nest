import fs from 'fs';
import path from 'path';
import { net } from 'electron';
import { paths } from '@/main/utils/paths';
import { logger } from '@/shared/utils/log';

const log = logger(__SOURCE_FILE__);

function cachePath(faviconUrl: string): string {
  const hash = Buffer.from(faviconUrl).toString('base64url').slice(0, 32);
  return path.join(paths.getCacheDir(), `${hash}.txt`);
}

export async function fetchFaviconDataUrl(faviconUrl: string): Promise<string> {
  if (!faviconUrl) {
    return '';
  }

  // Check cache first
  const cp = cachePath(faviconUrl);
  if (fs.existsSync(cp)) {
    return fs.readFileSync(cp, 'utf-8');
  }

  // Fetch via Electron net (respects system proxy)
  try {
    const response = await net.fetch(faviconUrl);
    if (!response.ok) {
      log.warn('Favicon fetch failed:', faviconUrl, response.status);
      return '';
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

    // Write cache
    fs.writeFileSync(cp, dataUrl, 'utf-8');

    return dataUrl;
  } catch (error) {
    log.warn('Favicon fetch error:', faviconUrl, error);
    return '';
  }
}
