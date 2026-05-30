export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export type LogContext = Record<string, unknown>;

export interface LogMessage {
  level: LogLevel;
  ctx: LogContext;
  serializedParams: string[];
}

export interface LogAPI {
  sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void;
}

declare global {
  interface Window {
    __app_log__?: LogAPI;
  }
}
