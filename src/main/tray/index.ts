import { Tray, Menu, nativeImage, app } from 'electron';
import { windowManager } from '../windowManager';
import { paths } from '../utils/paths';
import { i18nService } from '../services/i18nService';

let tray: Tray | null = null;

function getMainWindow() {
  return windowManager.getWindow('main');
}

export const appTray = {
  create() {
    const icon = nativeImage.createFromPath(paths.getTrayIconPath());

    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }

    tray = new Tray(icon);

    tray.on('click', () => {
      const mainWindow = getMainWindow();
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
      }
    });

    const contextMenu = Menu.buildFromTemplate([
      { label: i18nService.t('tray.show'), click: () => getMainWindow()?.show() },
      { label: i18nService.t('tray.hide'), click: () => getMainWindow()?.hide() },
      { type: 'separator' },
      { label: i18nService.t('tray.quit'), click: () => app.quit() },
    ]);

    tray.setContextMenu(contextMenu);
  },

  destroy() {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  },
};
