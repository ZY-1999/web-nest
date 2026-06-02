import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export const paths = {
  getWebNestBaseDir(): string {
    return process.env.WEB_NEST_HOME || path.join(app.getPath('home'), '.web-nest');
  },
  getConfigDir(): string {
    const dir = path.join(this.getWebNestBaseDir());
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },
  getCacheDir(): string {
    const dir = path.join(this.getWebNestBaseDir(), '.cache');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },

  getPreloadPath() {
    return path.join(__dirname, '../preload/index.js');
  },
  getRendererPath() {
    return path.join(__dirname, '../renderer/index.html');
  },
  getWebAppTitlebarPath() {
    return path.join(__dirname, '../renderer/webapp-titlebar.html');
  },
  getAssetPath(...segments: string[]) {
    return path.join(__dirname, 'assets', ...segments);
  },
  getIconPath() {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'icons')
      : path.join(process.cwd(), 'build/icons');
  },
  getTrayIconPath() {
    const iconPath = this.getIconPath();
    const trayPath = path.join(iconPath, 'tray');

    if (process.platform === 'win32') {
      return path.join(trayPath, 'icon.ico');
    }
    if (process.platform === 'darwin') {
      return path.join(trayPath, 'iconTemplate.png');
    }
    if (process.platform === 'linux') {
      return path.join(trayPath, 'icon_32x32.png');
    }

    return path.join(trayPath, 'iconTemplate.png');
  },
};
