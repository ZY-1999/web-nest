import fs from 'fs';
import path from 'path';
import { net } from 'electron';
import { paths } from '@/main/utils/paths';
import { logger } from '@/shared/utils/log';

const log = logger(__SOURCE_FILE__);

class FaviconService {
  private faviconCachePath(appId: string): string {
    return path.join(paths.getCacheDir(), 'favicons', `${appId}.txt`);
  }

  /** Read cached favicon data URL synchronously. Returns undefined if not cached. */
  getCachedFaviconDataUrlSync(appId: string): string | undefined {
    const cp = this.faviconCachePath(appId);
    if (fs.existsSync(cp)) {
      return fs.readFileSync(cp, 'utf-8');
    }
    return undefined;
  }

  /** Delete cached favicon for an app. */
  clearAppFaviconCache(appId: string): void {
    const cp = this.faviconCachePath(appId);
    try {
      if (fs.existsSync(cp)) {
        fs.unlinkSync(cp);
      }
    } catch { /* ignore cleanup errors */ }
  }

  async fetchFaviconDataUrl(appId: string, faviconUrl: string): Promise<string> {
    if (!faviconUrl) {
      return '';
    }

    // Check per-app cache first
    const cp = this.faviconCachePath(appId);
    if (fs.existsSync(cp)) {
      return fs.readFileSync(cp, 'utf-8');
    }

    // Fetch via Electron net (respects system proxy)
    try {
      const response = await net.fetch(faviconUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        log.warn('Favicon fetch failed:', faviconUrl, response.status);
        return '';
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await response.arrayBuffer());
      const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

      // Write to per-app cache
      fs.mkdirSync(path.dirname(cp), { recursive: true });
      fs.writeFileSync(cp, dataUrl, 'utf-8');

      return dataUrl;
    } catch (error) {
      log.warn('Favicon fetch error:', faviconUrl, error);
      return '';
    }
  }
}

export const faviconService = new FaviconService();
