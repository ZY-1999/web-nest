import { app, dialog } from 'electron';
import { logManager, logger } from '@/shared/utils/log';
import { initUpdater } from './updater';
import { appTray } from './tray';
import { createMainWindow } from './mainWindow';
import { registerMainServices } from './services';
import { serialize } from '@/shared/utils/serialize';
import { paths } from './utils/paths';
import { webAppService } from './services/webAppService';
import { windowManager } from './windowManager';

const log = logger(__SOURCE_FILE__);

function parseOpenAppArg(argv: string[] = process.argv): string | null {
  const arg = argv.find((a) => a.startsWith('--open-app='));
  if (!arg) { return null; }
  return arg.slice('--open-app='.length) || null;
}

// Configure session data directory before any sessions are created
app.setPath('sessionData', paths.getSessionDir());

logManager.initLog({
  level: app.isPackaged ? 'info' : 'debug',
  maxSize: 5 * 1024 * 1024,
  format: ({ ctx, params, level, timestamp }) => {
    const time = timestamp.toISOString();
    const source = ctx.source ? `[${ctx.source}]` : '';
    const ctxEntries = Object.entries(ctx).filter(([k]) => k !== 'source');
    const ctxStr = ctxEntries.map(([k, v]) => `[${k}:${String(v)}]`).join(' ');
    const msg = params.map((p) => serialize(p)).join(' ');
    return `${time} [${level}]${source}${ctxStr} ${msg}`;
  },
});

// Single instance lock — second instance forwards args to the first
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', async (_event, argv) => {
    const secondAppId = parseOpenAppArg(argv);
    if (secondAppId) {
      webAppService.openWebApp(secondAppId).catch((err) => {
        log.error('Failed to open web app from second instance:', secondAppId, err);
      });
    } else {
      const mainWin = windowManager.getWindow('main');
      if (mainWin) {
        mainWin.show();
      } else {
        // No main window (shortcut mode) — create one for the user
        await createMainWindow();
        appTray.create();
        registerMainServices();
      }
    }
  });

  app.whenReady().then(async () => {
    const openAppId = parseOpenAppArg();

    if (openAppId) {
      // Shortcut mode: open target web app without management window
      registerMainServices();
      try {
        await webAppService.openWebApp(openAppId);
        log.info('Shortcut mode: opened web app', openAppId);
      } catch (error) {
        log.error('Shortcut mode: failed to open web app:', openAppId, error);
        dialog.showErrorBox('Web Nest', `无法打开应用: ${openAppId}`);
        app.quit();
      }
      return;
    }

    // Normal mode: launch with management window
    await createMainWindow();
    appTray.create();

    registerMainServices();

    initUpdater({
      updateServerURL: process.env.UPDATE_SERVER_URL ?? '',
      autoCheckOnStartup: process.env.AUTO_CHECK_ON_STARTUP !== 'false',
      autoDownload: process.env.AUTO_DOWNLOAD === 'true',
      checkInterval: parseInt(process.env.UPDATE_CHECK_INTERVAL ?? '3600000', 10),
    });

    app.on('activate', async () => {
      await createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
