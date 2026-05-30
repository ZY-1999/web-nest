import path from 'path';
import { app } from 'electron';

export const paths = {
  getPreloadPath() {
    return path.join(__dirname, '../preload/index.js');
  },
  getRendererPath() {
    return path.join(__dirname, '../renderer/index.html');
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
