export class ChannelTimeoutError extends Error {
  readonly method: string;
  constructor(method: string) {
    super(`Request timeout: ${method}`);
    this.method = method;
    this.name = 'ChannelTimeoutError';
    Object.setPrototypeOf(this, ChannelTimeoutError.prototype);
  }
}
