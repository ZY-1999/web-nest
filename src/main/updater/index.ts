import { autoUpdater } from 'electron-updater';
import { logger } from '@/shared/utils/log';
import type { UpdateConfig, UpdateProgressInfo } from './types';

const log = logger(__SOURCE_FILE__);

function createUpdateManager(config: UpdateConfig) {
  const { updateServerURL, autoCheckOnStartup, autoDownload, checkInterval } = config;
  let checkTimer: ReturnType<typeof setInterval> | null = null;

  function setupAutoUpdater() {
    if (updateServerURL) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: updateServerURL,
      });
    }
    autoUpdater.logger = log;
    autoUpdater.autoDownload = autoDownload;
    autoUpdater.autoInstallOnAppQuit = autoDownload;

    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
    });
    autoUpdater.on('update-not-available', (info) => {
      log.info('Already up to date:', info.version);
    });
    autoUpdater.on('download-progress', (progress: UpdateProgressInfo) => {
      log.info(`Download progress: ${progress.percent.toFixed(2)}%`);
    });
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
    });
    autoUpdater.on('error', (error: Error) => {
      log.error('Update error:', error.message);
    });
  }

  async function checkForUpdates(): Promise<void> {
    if (!updateServerURL) {
      log.warn('No update server URL configured, skipping check');
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (error: unknown) {
      log.error('Failed to check for updates:', (error as Error).message);
    }
  }

  async function downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error: unknown) {
      log.error('Failed to download update:', (error as Error).message);
      throw error;
    }
  }

  function quitAndInstall(): void {
    log.info('Quitting and installing update...');
    autoUpdater.quitAndInstall();
  }

  function stopAutoCheck(): void {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
      log.info('Stopped auto update check');
    }
  }

  function startAutoCheck(interval?: number): void {
    const ms = interval ?? checkInterval;
    if (!ms || ms <= 0) {
      return;
    }
    stopAutoCheck();
    log.info(`Starting auto update check, interval: ${ms}ms`);
    checkTimer = setInterval(() => {
      checkForUpdates();
    }, ms);
  }

  function init(): void {
    if (autoCheckOnStartup) {
      setTimeout(() => {
        checkForUpdates();
      }, 5000);
    }
    if (checkInterval && checkInterval > 0) {
      startAutoCheck();
    }
  }

  setupAutoUpdater();

  return {
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    startAutoCheck,
    stopAutoCheck,
    init,
  };
}

type UpdateManager = ReturnType<typeof createUpdateManager>;
let updateManager: UpdateManager | null = null;

export function initUpdater(config: UpdateConfig): UpdateManager {
  if (!updateManager) {
    updateManager = createUpdateManager(config);
  }
  updateManager.init();
  return updateManager;
}

export function getUpdater(): UpdateManager | null {
  return updateManager;
}
