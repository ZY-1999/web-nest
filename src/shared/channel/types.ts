export type Handler = (payload: unknown) => Promise<unknown> | unknown;
export type AnyRequestHandler = (viewId: string, payload: unknown) => Promise<unknown> | unknown;

export interface ChannelAPI {
  request(method: string, payload?: unknown, timeout?: number): Promise<unknown>;
  onRequest(method: string, handler: Handler): void;
  offRequest(method: string): void;
  setDefaultTimeout(timeout: number): void;
}

export interface ChannelCenter {
  requestTo(viewId: string, method: string, payload?: unknown, timeout?: number): Promise<unknown>;
  broadcast(method: string, payload?: unknown, timeout?: number): Promise<void>;
  onRequest(viewId: string, method: string, handler: Handler): void;
  onAnyRequest(method: string, handler: AnyRequestHandler): void;
  offAnyRequest(method: string): void;
  getAllChannels(): Map<string, ChannelAPI>;
}

export interface ChannelLike {
  request(method: string, payload?: unknown, timeout?: number): Promise<unknown>;
  onRequest(method: string, handler: Handler): void;
}

export interface ChannelRequest {
  id: string;
  type: 'request';
  method: string;
  payload?: unknown;
}

export interface ChannelResponse {
  id: string;
  type: 'response';
  payload?: unknown;
  error?: string;
}

export type ChannelMessage = ChannelRequest | ChannelResponse;

export interface InitOptions {
  defaultTimeout?: number;
  /**
   * main only
   */
  webContentsId?: number;
  /**
   * proload only
   */
  expose?: boolean;
}
