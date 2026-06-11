import './errorHandlers';

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
import { i18nService } from './services/i18nService';
import { settingsService } from './services/settingsService';
import { themeService } from './services/themeService';

const log = logger(__SOURCE_FILE__);

function parseOpenAppArg(argv: string[] = process.argv): string | null {
  const arg = argv.find((a) => a.startsWith('--open-app='));
  if (!arg) {
    return null;
  }
  return arg.slice('--open-app='.length) || null;
}

/** Launch management window + tray (services are registered once at app ready). */
async function launchManagementWindow(): Promise<void> {
  await createMainWindow();
  appTray.create();
}

function main(): void {
  // ── Phase 1: Pre-app-ready 基础设施 ──────────────────────────────────
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

  // ── Phase 2: 配置加载 + 启动前 flags ─────────────────────────────────
  settingsService.init();

  if (settingsService.getSettingsSync().disableGpu) {
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    log.info('GPU hardware acceleration disabled by settings');
  }

  // ── Phase 3: 单实例锁 ────────────────────────────────────────────────
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return;
  }

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
        await launchManagementWindow();
      }
    }
  });

  // ── Phase 4: App ready 后初始化 ──────────────────────────────────────
  app.whenReady().then(async () => {
    // Register IPC handlers BEFORE any window creation, so renderers never race
    registerMainServices();

    // Restore services from persisted settings (safe to call setSettingsSync now)
    themeService.init();
    i18nService.init();

    // Apply runtime settings effects (autoLaunch, userAgent, proxy — requires app ready)
    settingsService.applyRuntimeEffects();

    const openAppId = parseOpenAppArg();

    if (openAppId) {
      // Shortcut mode: open target web app without management window
      try {
        await webAppService.openWebApp(openAppId);
        log.info('Shortcut mode: opened web app', openAppId);
      } catch (error) {
        log.error('Shortcut mode: failed to open web app:', openAppId, error);
        dialog.showErrorBox('Web Nest', i18nService.t('errors.failedToOpenApp', { id: openAppId }));
        app.quit();
      }
      return;
    }

    // Normal mode: launch with management window
    await launchManagementWindow();

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

  // ── Phase 5: 全局事件 ────────────────────────────────────────────────
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

main();
