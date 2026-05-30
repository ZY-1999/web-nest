import { Tray, Menu, nativeImage, app } from 'electron';
import { windowManager } from '../windowManager';
import { paths } from '../utils/paths';

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
      { label: 'Show', click: () => getMainWindow()?.show() },
      { label: 'Hide', click: () => getMainWindow()?.hide() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
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
