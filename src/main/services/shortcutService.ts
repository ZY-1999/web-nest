import { app, nativeImage, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/shared/utils/log';
import { paths } from '@/main/utils/paths';
import { i18nService } from '@/main/services/i18nService';

const log = logger(__SOURCE_FILE__);

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

class ShortcutService {
  private sanitizeFileName(title: string): string {
    let name = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    // Remove trailing dots and spaces (Windows forbids these)
    name = name.replace(/[.\s]+$/, '');
    // Handle empty result or reserved name
    const baseName = name.toUpperCase().replace(/\..*$/, '');
    if (!name || WINDOWS_RESERVED_NAMES.has(baseName)) {
      return 'shortcut';
    }
    return name;
  }

  /** Directory for per-app shortcut icon files (.ico). */
  private getShortcutIconsDir(): string {
    const dir = path.join(paths.getCacheDir(), 'shortcut-icons');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Convert a favicon data URL to a .ico file on disk (ICO-PNG format). Returns the path or undefined. */
  private writeFaviconIco(appId: string, faviconDataUrl: string): string | undefined {
    try {
      if (!faviconDataUrl.startsWith('data:')) { return undefined; }
      const img = nativeImage.createFromDataURL(faviconDataUrl);
      if (img.isEmpty()) { return undefined; }

      const pngBuf = img.toPNG();
      const icoPath = path.join(this.getShortcutIconsDir(), `${appId}.ico`);

      // Minimal ICO header: 6 bytes header + 16 bytes directory entry + PNG payload
      const header = Buffer.alloc(6);
      header.writeUInt16LE(0, 0); // reserved
      header.writeUInt16LE(1, 2); // type = ICO
      header.writeUInt16LE(1, 4); // count = 1 image

      const entry = Buffer.alloc(16);
      const w = img.getSize().width;
      const h = img.getSize().height;
      entry.writeUInt8(w >= 256 ? 0 : w, 0); // 0 means 256
      entry.writeUInt8(h >= 256 ? 0 : h, 1);
      entry.writeUInt8(0, 2); // color palette
      entry.writeUInt8(0, 3); // reserved
      entry.writeUInt16LE(1, 4); // color planes
      entry.writeUInt16LE(32, 6); // bits per pixel
      entry.writeUInt32LE(pngBuf.length, 8); // image size
      entry.writeUInt32LE(22, 12); // offset = 6 + 16 = 22

      const ico = Buffer.concat([header, entry, pngBuf]);
      fs.writeFileSync(icoPath, ico);
      log.info('Favicon ICO written:', icoPath);
      return icoPath;
    } catch (error) {
      log.warn('Failed to write favicon ICO:', appId, error);
      return undefined;
    }
  }

  /** Check if the current platform supports desktop shortcuts (Windows only). */
  isShortcutSupported(): boolean {
    return process.platform === 'win32';
  }

  /** Create a desktop shortcut that opens a specific web app. Returns true on success. */
  createDesktopShortcut(appId: string, title: string, faviconDataUrl?: string): boolean {
    if (!this.isShortcutSupported()) {
      log.warn('Desktop shortcuts not supported on this platform');
      return false;
    }

    const linkPath = path.join(app.getPath('desktop'), `${this.sanitizeFileName(title)}.lnk`);

    // Prefer per-app favicon icon, fallback to default app icon
    let iconPath: string;
    if (faviconDataUrl) {
      const faviconIco = this.writeFaviconIco(appId, faviconDataUrl);
      iconPath = faviconIco ?? path.join(paths.getIconPath(), 'app', 'icon.ico');
    } else {
      iconPath = path.join(paths.getIconPath(), 'app', 'icon.ico');
    }

    const success = shell.writeShortcutLink(linkPath, 'create', {
      target: process.execPath,
      args: `--open-app=${appId}`,
      description: i18nService.t('errors.shortcutDescription', { title }),
      icon: iconPath,
      iconIndex: 0,
      appUserModelId: `web-nest.webapp-${appId}`,
    });

    if (success) {
      log.info('Desktop shortcut created:', linkPath);
    } else {
      log.warn('Failed to create desktop shortcut:', linkPath);
    }
    return success;
  }

  /** Remove all desktop shortcuts matching a web app, and clean up cached icon. */
  async removeDesktopShortcut(appId: string): Promise<void> {
    const desktop = app.getPath('desktop');
    let files: string[];
    try {
      files = await fs.promises.readdir(desktop);
    } catch {
      return;
    }

    for (const file of files) {
      if (!file.endsWith('.lnk')) { continue; }
      const fullPath = path.join(desktop, file);
      try {
        const link = shell.readShortcutLink(fullPath);
        if (link.args?.includes(`--open-app=${appId}`)) {
          await fs.promises.unlink(fullPath);
          log.info('Desktop shortcut removed:', fullPath);
        }
      } catch {
        // Not a valid shortcut or unreadable — skip
      }
    }

    // Clean up cached favicon .ico
    const icoPath = path.join(this.getShortcutIconsDir(), `${appId}.ico`);
    try {
      await fs.promises.unlink(icoPath);
    } catch {
      // File may not exist — ignore
    }
  }

  /** Check if a desktop shortcut exists for a web app. */
  async hasDesktopShortcut(appId: string): Promise<boolean> {
    const desktop = app.getPath('desktop');
    let files: string[];
    try {
      files = await fs.promises.readdir(desktop);
    } catch {
      return false;
    }

    for (const file of files) {
      if (!file.endsWith('.lnk')) { continue; }
      try {
        const link = shell.readShortcutLink(path.join(desktop, file));
        if (link.args?.includes(`--open-app=${appId}`)) {
          return true;
        }
      } catch {
        // skip
      }
    }
    return false;
  }
}

export const shortcutService = new ShortcutService();
