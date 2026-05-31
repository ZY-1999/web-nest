import { Menu, screen } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { windowManager } from './windowManager';
import { viewManager } from './viewManager';
import { isDev } from '@/shared/utils/env';
import { paths } from './utils/paths';
import { channel } from '@/shared/channel';
import { logger } from '@/shared/utils/log';
import { themeService } from './services/themeService';

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

  const tokens = await themeService.getTheme();

  const windowId = windowManager.createWindow({
    id: 'main',
    closeAction: 'hide',
    options: {
      x: -10000,
      y: -10000,
      width: 1200,
      height: 800,
      icon: join(iconPath, 'app', iconFile),
      backgroundColor: tokens.bg,
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
    backgroundColor: tokens.bg,
  });

  const view = viewManager.getView(viewId)!;
  view.attachTo(win, { ...win.getContentBounds(), x: 0, y: 0 });

  const mainWin = windowManager.getWindow('main')!;
  mainWin.on('resized', (bounds, contentBounds) => {
    log.info('Window resized - bounds:', bounds, 'contentBounds:', contentBounds);
    view.webContentsView.setBounds({ ...contentBounds, x: 0, y: 0 });
  });

  // Reposition window to screen center after content is ready
  setTimeout(() => {
    const { width, height } = win.getBounds();
    const { workArea } = screen.getPrimaryDisplay();
    const x = Math.round(workArea.x + (workArea.width - width) / 2);
    const y = Math.round(workArea.y + (workArea.height - height) / 2);
    win.setBounds({ ...win.getBounds(), x, y });
  }, 50);

  log.info('Main window created successfully');
}
