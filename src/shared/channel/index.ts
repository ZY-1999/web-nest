import { ChannelApiImpl, type Port as PortType } from './impl';
import type { ChannelAPI, InitOptions } from './types';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { portManager } from './portManager';

const log = logger('channel');

@Singleton('preload', 'renderer')
export class Channel implements ChannelAPI {
  private webContentsId: number | null = null;
  private api: ChannelApiImpl;
  private initCount = 0;

  constructor() {
    if (process.env.PROCESS_TYPE === 'renderer') {
      this.api = window.__app_channel__ as unknown as ChannelApiImpl;
    } else {
      this.api = new ChannelApiImpl();
    }
  }

  setPort(port: PortType): void {
    this.api.setPort(port);
  }

  async init(options: InitOptions = {}): Promise<void> {
    this.initCount++;
    log.debug(
      `Channel init called (count: ${this.initCount}), processType: ${process.env.PROCESS_TYPE}`,
    );
    const { webContentsId, defaultTimeout, expose } = options;
    if (defaultTimeout !== undefined) {
      this.api.setDefaultTimeout(defaultTimeout);
    }
    if (process.env.PROCESS_TYPE === 'main') {
      if (webContentsId === undefined) {
        throw new Error('webContentsId is required in main process');
      }
      this.webContentsId = webContentsId;
      portManager.registerMain(this.webContentsId, (port) => {
        log.debug(`Port ready for webContentsId: ${this.webContentsId}`);
        this.setPort(port);
      });
    } else if (process.env.PROCESS_TYPE === 'preload') {
      portManager.registerPreload((port) => {
        log.debug('Preload port ready');
        this.setPort(port);
      });
      if (expose !== false) {
        const { contextBridge } = await import('electron');
        contextBridge.exposeInMainWorld('__app_channel__', {
          request: this.api.request.bind(this.api),
          onRequest: this.api.onRequest.bind(this.api),
          offRequest: this.api.offRequest.bind(this.api),
          setDefaultTimeout: this.api.setDefaultTimeout.bind(this.api),
        });
        log.debug('Channel API exposed to renderer process');
      }
    }
  }

  request(method: string, payload?: unknown, timeout?: number): Promise<unknown> {
    return this.api.request(method, payload, timeout);
  }

  onRequest(method: string, handler: (payload: unknown) => unknown): void {
    this.api.onRequest(method, handler);
  }

  offRequest(method: string): void {
    this.api.offRequest(method);
  }

  setDefaultTimeout(timeout: number): void {
    this.api.setDefaultTimeout(timeout);
  }

  destroy(): void {
    log.debug(`Channel destroy called, webContentsId: ${this.webContentsId}`);

    if (process.env.PROCESS_TYPE === 'renderer') {
      return;
    }
    if (this.webContentsId !== null) {
      portManager.unregister(this.webContentsId);
    }
    this.api.clearPending();
    this.webContentsId = null;
  }
}

export const channel = new Channel();

export * from './types';
export * from './error';

declare global {
  interface Window {
    __app_channel__: ChannelAPI;
  }
}
