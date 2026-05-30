import type { LogLevel, LogContext } from './types';

export interface LogSender {
  sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void;
}

let initPromise: Promise<LogSender> | null = null;

function initSender() {
  return (initPromise ??= (async () => {
    if (process.env.PROCESS_TYPE === 'main') {
      const { ipcMain } = await import('electron');
      const mainLog = (await import('electron-log/main')).default;
      const sendLog = (level: LogLevel, ctx: LogContext, serializedParams: string[]) => {
        mainLog[level](ctx, ...serializedParams);
      };
      ipcMain.on(
        '__app_log__',
        (
          _event: Electron.IpcMainEvent,
          msg: { level: LogLevel; ctx: LogContext; serializedParams: string[] },
        ) => {
          sendLog(msg.level, msg.ctx, msg.serializedParams);
        },
      );
      return { sendLog };
    } else if (process.env.PROCESS_TYPE === 'preload') {
      const { contextBridge, ipcRenderer } = await import('electron');
      const sendLog = (level: LogLevel, ctx: LogContext, serializedParams: string[]) => {
        ipcRenderer.send('__app_log__', { level, ctx, serializedParams });
      };
      contextBridge.exposeInMainWorld('__app_log__', { sendLog });
      return { sendLog };
    } else {
      return {
        sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void {
          window.__app_log__?.sendLog(level, ctx, serializedParams);
        },
      };
    }
  })());
}

export function logSender(): LogSender & { init: () => Promise<LogSender> } {
  return {
    init: initSender,
    sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void {
      initSender().then((s) => s.sendLog(level, ctx, serializedParams));
    },
  };
}
