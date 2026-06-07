import { app } from 'electron';
import { logManager } from '@/shared/utils/log';
import { initUpdater } from './updater';
import { appTray } from './tray';
import { createMainWindow } from './mainWindow';
import { registerMainServices } from './services';
import { serialize } from '@/shared/utils/serialize';
import { paths } from './utils/paths';

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

app.whenReady().then(async () => {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
