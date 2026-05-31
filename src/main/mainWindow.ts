import { Menu } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { windowManager } from './windowManager';
import { viewManager } from './viewManager';
import { isDev } from '@/shared/utils/env';
import { paths } from './utils/paths';
import { channel } from '@/shared/channel';
import { logger } from '@/shared/utils/log';

const log = logger(__SOURCE_FILE__);

export async function createMainWindow() {
  log.info('Creating main window, env:', isDev() ? 'development' : 'production');
  const existing = windowManager.getWindow('main');
  if (existing) {
    log.info('Main window already exists, showing it');
    existing.show();
    return;
  }

  Menu.setApplicationMenu(null);

  const iconPath = paths.getIconPath();
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';

  const windowId = windowManager.createWindow({
    id: 'main',
    closeAction: 'hide',
    options: {
      width: 1200,
      height: 800,
      icon: join(iconPath, 'app', iconFile),
    },
  });

  const win = windowManager.getNativeWindow(windowId)!;

  const viewUrl = isDev() ? 'http://localhost:5173' : pathToFileURL(paths.getRendererPath()).href;

  log.info('Loading view URL:', viewUrl);

  const viewId = await viewManager.createView({
    url: viewUrl,
    type: 'embedded',
    channel,
    preload: paths.getPreloadPath(),
    id: 'main-view',
  });

  const view = viewManager.getView(viewId)!;
  view.attachTo(win, { ...win.getContentBounds(), x: 0, y: 0 });

  const mainWin = windowManager.getWindow('main')!;
  mainWin.on('resized', (bounds, contentBounds) => {
    log.info('Window resized - bounds:', bounds, 'contentBounds:', contentBounds);
    view.webContentsView.setBounds({ ...contentBounds, x: 0, y: 0 });
  });

  log.info('Main window created successfully');
}
