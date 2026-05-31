import { serviceRegistry } from '@/shared/serviceRegistry';

export abstract class UpdaterApi {
  static apiName = 'UpdaterApi';
  abstract checkForUpdates(): Promise<void>;
  abstract quitAndInstall(): Promise<void>;
}

export const updaterServiceApi = serviceRegistry.defineApi(UpdaterApi, 'main');
