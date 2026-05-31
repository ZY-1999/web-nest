import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import type { Port as PortType } from './impl';

const log = logger(__SOURCE_FILE__);

type PortReadyCallback = (port: PortType) => void;

type ChannelEntry = {
  port2: Electron.MessagePortMain | null;
  onPortReady: PortReadyCallback;
  webContentsId: number;
  port1: Electron.MessagePortMain | null;
  initCount: number;
};

export function closePort(port: PortType | null): void {
  if (!port) {
    return;
  }

  try {
    if ('close' in port) {
      (port as Electron.MessagePortMain).close();
    } else {
      (port as MessagePort).close();
    }
  } catch (error) {
    log.debug('Error closing port:', (error as Error).message);
  }
}

@Singleton()
export class PortManager {
  private registry = new Map<number, ChannelEntry>();
  private isHandlerSetup = false;

  constructor() {
    this.setupMainProcessHandler();
  }

  private setupMainProcessHandler(): void {
    if (process.env.PROCESS_TYPE !== 'main' || this.isHandlerSetup) {
      return;
    }

    log.debug('Setting up main process IPC handler');

    (async () => {
      const { ipcMain, webContents } = await import('electron');

      ipcMain.handle('__channel_request_port__', async (event, requestId?: string) => {
        const webContentsId = event.sender.id;
        log.debug(
          `Received port request from webContentsId: ${webContentsId}, requestId: ${requestId}`,
        );

        const entry = this.registry.get(webContentsId);

        if (!entry) {
          log.error(`Channel not initialized for webContentsId: ${webContentsId}`);
          throw new Error(`Channel not initialized for webContentsId: ${webContentsId}`);
        }

        const wc = webContents.fromId(webContentsId);
        if (!wc) {
          log.error(`WebContents not found for id: ${webContentsId}`);
          throw new Error('WebContents not found');
        }

        // Close existing ports before creating new ones to avoid stale connections
        if (entry.port1) {
          log.debug(`Closing stale port1 for webContentsId: ${webContentsId}`);
          closePort(entry.port1);
          entry.port1 = null;
        }
        if (entry.port2) {
          log.debug(`Closing stale port2 for webContentsId: ${webContentsId}`);
          closePort(entry.port2);
          entry.port2 = null;
        }

        const { MessageChannelMain } = await import('electron');
        const { port1, port2 } = new MessageChannelMain();

        this.setupPort1CloseListener(port1, entry);

        port1.start();
        log.debug(`Port1 started for webContentsId: ${webContentsId}`);

        entry.port1 = port1;
        entry.onPortReady(port1);
        entry.port2 = port2;

        const portToTransfer = entry.port2!;
        entry.port2 = null;

        log.debug(`Transferring port to webContentsId: ${webContentsId}, requestId: ${requestId}`);
        wc.postMessage('__channel_port_transfer__', requestId ?? null, [portToTransfer]);
      });
    })();

    this.isHandlerSetup = true;
  }

  private setupPort1CloseListener(port1: Electron.MessagePortMain, entry: ChannelEntry): void {
    port1.on('close', () => {
      log.debug(`Port1 closed for webContentsId: ${entry.webContentsId}`);

      closePort(port1);

      if (entry.port2) {
        log.debug(`Closing port2 for webContentsId: ${entry.webContentsId}`);
        closePort(entry.port2);
        entry.port2 = null;
      }

      entry.port1 = null;
    });
  }

  registerMain(webContentsId: number, onPortReady: PortReadyCallback): void {
    const existingEntry = this.registry.get(webContentsId);

    if (existingEntry) {
      existingEntry.initCount++;
      existingEntry.onPortReady = onPortReady;
      log.debug(
        `Re-registering channel for webContentsId: ${webContentsId}, init count: ${existingEntry.initCount}`,
      );
    } else {
      const entry: ChannelEntry = {
        port2: null,
        onPortReady,
        webContentsId,
        port1: null,
        initCount: 1,
      };
      this.registry.set(webContentsId, entry);
      log.debug(`Registered channel for webContentsId: ${webContentsId}`);
    }
  }

  registerPreload(onPortReady: PortReadyCallback): void {
    log.debug('Registering preload port request');

    (async () => {
      const { ipcRenderer } = await import('electron');

      // Use a unique request ID to ensure this IIFE receives the correct paired port
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const portPromise = new Promise<PortType>((resolve, reject) => {
        let isResolved = false;

        const handler = (event: Electron.IpcRendererEvent, id?: string) => {
          // Only accept ports matching our request ID (or legacy without ID)
          if (id !== undefined && id !== requestId) {
            return;
          }
          if (isResolved) {
            return;
          }
          isResolved = true;
          
          ipcRenderer.off('__channel_port_transfer__', handler);
          log.debug(`Port received from main process (requestId: ${requestId})`);
          resolve(event.ports[0]);
        };

        ipcRenderer.on('__channel_port_transfer__', handler);

        setTimeout(() => {
          if (isResolved) {
            return;
          }
          isResolved = true;
          
          ipcRenderer.off('__channel_port_transfer__', handler);
          log.error('Channel port transfer timeout after 5000ms');
          reject(new Error('Channel port transfer timeout after 5000ms'));
        }, 5000);
      });

      await ipcRenderer.invoke('__channel_request_port__', requestId);
      log.debug('Port request sent to main process');

      const port = await portPromise;

      this.setupPreloadPortCloseListener(port as MessagePort);

      port.start();
      log.debug('Preload port started');

      onPortReady(port);
    })();
  }

  private setupPreloadPortCloseListener(port: MessagePort): void {
    (port as unknown as { onclose: (() => void) | null }).onclose = () => {
      log.debug('Preload port closed');

      closePort(port);
    };
  }

  unregister(webContentsId: number): void {
    log.debug(`Unregistering channel for webContentsId: ${webContentsId}`);

    const entry = this.registry.get(webContentsId);
    if (entry) {
      closePort(entry.port1);
      closePort(entry.port2);
    }
    this.registry.delete(webContentsId);
  }
}

export const portManager = new PortManager();
