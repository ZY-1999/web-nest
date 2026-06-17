import { serviceRegistry } from '@/shared/serviceRegistry';

/**
 * API for the main management window.
 * Implemented in the main process; renderer proxy talks over the main channel.
 */
export abstract class MainWindowApi {
  static apiName = 'MainWindowApi';

  /** Toggle DevTools on the main window content view. */
  abstract toggleDevTools(): Promise<void>;
}

export const mainWindowApi = serviceRegistry.defineApi(MainWindowApi, 'main');
