import { logger } from '@/shared/utils/log';

const log = logger('errorHandlers');

type ErrorHandler = (error: unknown) => void;

const exceptionHandlers: ErrorHandler[] = [];
const rejectionHandlers: ErrorHandler[] = [];

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  for (const handler of exceptionHandlers) {
    try { handler(error); } catch { /* prevent handler errors from cascading */ }
  }
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
  for (const handler of rejectionHandlers) {
    try { handler(reason); } catch { /* prevent handler errors from cascading */ }
  }
});

/**
 * Register a custom handler for uncaught exceptions.
 * Handlers are called after the default logger output.
 */
export function onUncaughtException(handler: ErrorHandler): void {
  exceptionHandlers.push(handler);
}

/**
 * Register a custom handler for unhandled promise rejections.
 * Handlers are called after the default logger output.
 */
export function onUnhandledRejection(handler: ErrorHandler): void {
  rejectionHandlers.push(handler);
}
