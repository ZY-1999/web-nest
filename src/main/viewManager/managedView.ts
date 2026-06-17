import { LoadURLOptions, WebContentsView, WebPreferences } from 'electron';
import { TypedEmitter } from '@/shared/utils/typedEmitter';
import { Channel } from '@/shared/channel';
import { logger } from '@/shared/utils/log';
import type { ViewState, ViewType, ManagedViewEventMap } from '@/shared/view';
import type { ManagedView as IManagedView } from './types';

const log = logger(__SOURCE_FILE__);

export class ManagedView extends TypedEmitter<ManagedViewEventMap> implements IManagedView {
  readonly id: string;
  readonly type: ViewType;
  readonly webContentsView: WebContentsView;
  readonly channel: Channel;
  hostWindow: Electron.BrowserWindow | Electron.BaseWindow | null = null;

  private _loaded = false;
  private webContentsSubscriptions: Array<() => void> = [];

  constructor(id: string, options: { type: ViewType; channel?: Channel } & WebPreferences) {
    super();
    const { type, channel, ...restOptions } = options;
    this.id = id;
    this.type = type;
    this.channel = channel ?? new Channel();

    const webPreferences: Electron.WebPreferences = {
      contextIsolation: true,
      nodeIntegration: false,
      ...(options.type === 'offscreen' && { offscreen: true }),
      ...restOptions,
    };

    this.webContentsView = new WebContentsView({ webPreferences });

    this.setupWebContentsListeners();
  }

  private subscribeToWebContents(event: string, handler: (...args: unknown[]) => void): void {
    const wc = this.webContentsView.webContents;
    const subscription = () => {
      // @ts-expect-error - Electron types are strict about event names
      wc.off(event, handler);
    };
    this.webContentsSubscriptions.push(subscription);
    // @ts-expect-error - Electron types are strict about event names
    wc.on(event, handler);
  }

  private setupWebContentsListeners(): void {
    const finishLoadHandler = () => {
      this._loaded = true;
      this.emit('ready');
      this.emit('state-changed', this.state);
    };
    const focusHandler = () => this.emit('state-changed', this.state);
    const blurHandler = () => this.emit('state-changed', this.state);

    // Load-failure / renderer-crash are logged for diagnostics only — no recovery.
    // Keeps white-screen investigations traceable in ~/.web-nest/log/main.log.
    const failLoadHandler = (
      _event: unknown,
      errorCode: unknown,
      errorDescription: unknown,
      validatedURL: unknown,
    ) => {
      const wc = this.webContentsView.webContents;
      log.error('View did-fail-load', {
        viewId: this.id,
        url: wc.isDestroyed() ? '' : wc.getURL(),
        validatedURL,
        errorCode,
        errorDescription,
      });
    };
    const renderGoneHandler = (_event: unknown, details: unknown) => {
      const { reason, exitCode } = (details ?? {}) as { reason?: unknown; exitCode?: unknown };
      log.error('View render-process-gone', {
        viewId: this.id,
        reason,
        exitCode,
      });
    };

    this.subscribeToWebContents('did-finish-load', finishLoadHandler);
    this.subscribeToWebContents('did-fail-load', failLoadHandler);
    this.subscribeToWebContents('render-process-gone', renderGoneHandler);
    this.subscribeToWebContents('focus', focusHandler);
    this.subscribeToWebContents('blur', blurHandler);
  }

  async init(
    options: { url: string; defaultChannelTimeout?: number } & LoadURLOptions,
  ): Promise<void> {
    const { url, defaultChannelTimeout, ...restOptions } = options;
    await this.channel.init({
      webContentsId: this.webContentsView.webContents.id,
      defaultTimeout: defaultChannelTimeout,
    });
    await this.webContentsView.webContents.loadURL(url, restOptions);
  }

  attachTo(
    window: Electron.BrowserWindow | Electron.BaseWindow,
    bounds?: Electron.Rectangle,
  ): void {
    this.detach();
    (window.contentView as { addChildView: (v: unknown) => void }).addChildView(
      this.webContentsView,
    );
    this.hostWindow = window;
    if (bounds) {
      this.webContentsView.setBounds(bounds);
    }
    this.emit('state-changed', this.state);
  }

  detach(): void {
    if (!this.hostWindow) { return; }
    try {
      if (!this.hostWindow.isDestroyed()) {
        (this.hostWindow.contentView as { removeChildView?: (v: unknown) => void })
          .removeChildView?.(this.webContentsView);
      }
    } catch { /* native resource already gone */ }
    this.hostWindow = null;
  }

  toggleDevTools(): void {
    const wc = this.webContentsView.webContents;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
    } else {
      wc.openDevTools({ mode: 'detach' });
    }
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get state(): ViewState {
    const wc = this.webContentsView.webContents;
    const isDestroyed = wc.isDestroyed();
    return {
      id: this.id,
      type: this.type,
      url: isDestroyed ? '' : this.webContents.getURL(),
      bounds: this.type === 'offscreen' || isDestroyed ? null : this.webContentsView.getBounds(),
      visible: this.type !== 'offscreen' && !isDestroyed,
      focused: !isDestroyed && wc.isFocused?.() === true,
      loaded: this._loaded,
    };
  }

  destroy(): void {
    this.detach();

    // webContents may already be destroyed (e.g. closed by Playwright/OS)
    try {
      const wc = this.webContentsView.webContents;
      if (!wc.isDestroyed()) {
        this.webContentsSubscriptions.forEach((unsub) => unsub());
        wc.close();
      }
    } catch {
      // webContents native resource already gone
    }
    this.webContentsSubscriptions = [];

    this.removeAllListeners();

    this.channel.destroy();
  }
}
