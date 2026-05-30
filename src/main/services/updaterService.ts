import { UpdaterApi } from '@/shared/services';
import { autoUpdater } from 'electron-updater';
import { Singleton } from '@/shared/utils/singleton';

@Singleton()
class UpdaterService extends UpdaterApi {
  async checkForUpdates(): Promise<void> {
    await autoUpdater.checkForUpdates();
  }

  async quitAndInstall(): Promise<void> {
    autoUpdater.quitAndInstall();
  }
}

export const updaterService = new UpdaterService();
