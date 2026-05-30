export class ServiceTimeoutError extends Error {
  cause?: Error;
  constructor(service: string, method: string, timeout: number, cause?: Error) {
    super(`Service '${service}.${method}' timed out after ${timeout}ms`);
    this.name = 'ServiceTimeoutError';
    this.cause = cause;
  }
}
