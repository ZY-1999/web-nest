import { deserialize, serialize } from '@/shared/utils/serialize';
import { ChannelTimeoutError } from './error';
import type { ChannelMessage, ChannelRequest, ChannelResponse, Handler } from './types';

type ResponseHandler = (response: ChannelResponse) => void;
export type Port = Electron.MessagePortMain | MessagePort;

function generateId(method: string): string {
  return `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ChannelApiImpl {
  private port: Port | null = null;
  private handlers = new Map<string, Handler>();
  private pending = new Map<string, ResponseHandler>();
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 10000) {
    this.defaultTimeout = defaultTimeout;
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  setPort(port: Port): void {
    this.port = port;
    if (process.env.PROCESS_TYPE === 'main') {
      (port as Electron.MessagePortMain).on(
        'message',
        (e: Electron.MessageEvent) => void this.dispatch(e.data),
      );
    } else {
      (port as MessagePort).onmessage = (e: MessageEvent<ChannelMessage>) =>
        void this.dispatch(e.data);
    }
    port.start();
  }

  private async dispatch(msg: ChannelMessage): Promise<void> {
    if (msg.type === 'request') {
      const handler = this.handlers.get(msg.method);
      let response: ChannelResponse;
      if (!handler) {
        response = { id: msg.id, type: 'response', error: `No handler for method: ${msg.method}` };
      } else {
        try {
          const result = await handler(msg.payload);
          response = { id: msg.id, type: 'response', payload: result };
        } catch (err) {
          response = { id: msg.id, type: 'response', error: serialize(err) };
        }
      }
      this.port!.postMessage(response);
    } else {
      const resolve = this.pending.get(msg.id);
      if (resolve) {
        this.pending.delete(msg.id);
        const timeoutId = this.timeouts.get(msg.id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.timeouts.delete(msg.id);
        }
        resolve(msg);
      }
    }
  }

  request(method: string, payload?: unknown, timeout?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Channel port not initialized'));
        return;
      }
      const id = generateId(method);
      this.pending.set(id, (res) => {
        if (res.error) {
          reject(deserialize<Error>(res.error));
        } else {
          resolve(res.payload);
        }
      });
      const msg: ChannelRequest = { id, type: 'request', method, payload };
      this.port.postMessage(msg);

      const actualTimeout = timeout ?? this.defaultTimeout;
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        this.timeouts.delete(id);
        reject(new ChannelTimeoutError(method));
      }, actualTimeout);
      this.timeouts.set(id, timeoutId);
    });
  }

  onRequest(method: string, handler: Handler): void {
    this.handlers.set(method, handler);
  }

  offRequest(method: string): void {
    this.handlers.delete(method);
  }

  clearPending(): void {
    this.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeouts.clear();
    this.pending.forEach((resolve, id) => {
      resolve({ id, type: 'response', error: 'Channel destroyed' });
    });
    this.pending.clear();
    this.handlers.clear();
    this.port = null;
  }
}
