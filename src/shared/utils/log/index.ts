import type { LogFunctions, PathVariables, LogMessage as ElectronLogMessage } from 'electron-log';
import { serialize } from '@/shared/utils/serialize';
import { logSender } from './logSender';
import type { LogLevel, LogContext } from './types';

export type { LogContext, LogLevel, LogMessage } from './types';

export interface MessageInfo {
  ctx: LogContext;
  params: unknown[];
  level: string;
  timestamp: Date;
}

export interface LogConfig {
  level?: LogLevel;
  maxSize?: number;
  logDir?: string;
  resolveLogPath?: (message: MessageInfo) => string;
  format?: (info: MessageInfo) => string;
}

export interface Logger extends LogFunctions {
  with(ctx: LogContext): Logger;
}

let globalContext: LogContext = {};

export function logger(source: string, ctx?: LogContext): Logger {
  const instanceCtx: LogContext = { source, ...ctx };
  const { sendLog } = logSender();
  function makeMethod(level: LogLevel) {
    return (...params: unknown[]) => {
      const mergedCtx = { ...globalContext, ...instanceCtx };
      const serializedParams = params.map((p) => serialize(p));
      sendLog(level, mergedCtx, serializedParams);
    };
  }

  return {
    info: makeMethod('info'),
    warn: makeMethod('warn'),
    error: makeMethod('error'),
    verbose: makeMethod('verbose'),
    debug: makeMethod('debug'),
    silly: makeMethod('silly'),
    log: makeMethod('info'), // info shortcut
    with(extraCtx: LogContext): Logger {
      return logger(source, { ...instanceCtx, ...extraCtx });
    },
  } as Logger;
}

export const logManager = {
  setGlobalContext(ctx: LogContext): void {
    globalContext = { ...ctx };
  },

  mergeGlobalContext(ctx: LogContext): void {
    globalContext = { ...globalContext, ...ctx };
  },

  async initLog(config?: LogConfig): Promise<void> {
    this.setGlobalContext({
      ...globalContext,
      processType: process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer',
    });

    // Main 进程：配置 electron-log
    if (process.env.PROCESS_TYPE === 'main') {
      const mainLog = (await import('electron-log/main')).default;
      const path = (await import('path')).default;
      mainLog.initialize({ preload: false });

      if (config?.level) {
        mainLog.transports.file.level = config.level;
        mainLog.transports.console.level = config.level;
      }

      if (config?.maxSize !== undefined) {
        mainLog.transports.file.maxSize = config.maxSize;
      }

      if (config?.resolveLogPath || config?.logDir) {
        const userResolveLogPath = config.resolveLogPath;
        const logDir = config.logDir;
        mainLog.transports.file.resolvePathFn = (
          variables: PathVariables,
          message?: ElectronLogMessage,
        ) => {
          const ctx = (message?.data?.[0] as LogContext) ?? {};
          const params = message?.data?.slice(1) ?? [];
          const info: MessageInfo = {
            ctx,
            params,
            level: message?.level ?? 'info',
            timestamp: message?.date ?? new Date(),
          };
          const subDir = userResolveLogPath?.(info) ?? '';
          return path.join(
            logDir ?? variables.libraryDefaultDir,
            subDir,
            variables.fileName ?? 'main.log',
          );
        };
      }

      if (config?.format) {
        const userFormat = config.format;
        const formatWrapper = (params: {
          message?: ElectronLogMessage;
          data?: unknown[];
          level?: string;
          date?: Date;
        }) => {
          const message = params.message ?? params;
          const ctx = (message?.data?.[0] as LogContext) ?? {};
          const rest = message?.data?.slice(1) ?? [];
          const info: MessageInfo = {
            ctx,
            params: rest,
            level: message?.level ?? 'info',
            timestamp: message?.date ?? new Date(),
          };
          return [userFormat(info)];
        };
        mainLog.transports.file.format = formatWrapper;
        mainLog.transports.console.format = formatWrapper;
      }
    }
    if (process.env.PROCESS_TYPE === 'preload') {
      await logSender().init();
    }
  },
};

export const log = logger('default');
