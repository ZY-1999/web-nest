import { BaseWindow, app } from 'electron';
import { TypedEmitter } from '@/shared/utils/typedEmitter';
import type { WindowState, WindowOptions, ManagedWindowEventMap } from '@/shared/window';
import type { ManagedWindow as IManagedWindow } from './types';

export class ManagedWindow extends TypedEmitter<ManagedWindowEventMap> implements IManagedWindow {
  readonly id: string;
  readonly nativeWindow: BaseWindow;
  private closeAction: 'quit' | 'hide';
  private forceQuit = false;
  private appSubscriptions: Array<() => void> = [];

  constructor(id: string, options: WindowOptions) {
    super();
    this.id = id;
    this.closeAction = options.closeAction ?? 'quit';

    this.nativeWindow = new BaseWindow(options.options ?? {});

    this.setupHandlers();
  }

  private subscribeToApp(event: string, handler: (...args: unknown[]) => void): void {
    const subscription = () => {
      // @ts-expect-error - Electron types are strict about event names
      app.off(event, handler);
    };
    this.appSubscriptions.push(subscription);
    // @ts-expect-error - Electron types are strict about event names
    app.on(event, handler);
  }

  private setupHandlers(): void {
    this.subscribeToApp('before-quit', () => {
      this.forceQuit = true;
    });

    this.nativeWindow.on('close', (e: unknown) => {
      if (this.closeAction === 'hide' && !this.forceQuit) {
        (e as Electron.Event).preventDefault();
        this.nativeWindow.hide();
      }
    });

    this.nativeWindow.on('resize', () => {
      const bounds = this.nativeWindow.getBounds();
      const contentBounds = this.nativeWindow.getContentBounds();
      this.emit('resized', bounds, contentBounds);
    });
  }

  get state(): WindowState {
    const win = this.nativeWindow;
    const isDestroyed = win.isDestroyed();
    return {
      id: this.id,
      visible: !isDestroyed && win.isVisible(),
      focused: !isDestroyed && win.isFocused(),
      bounds: isDestroyed ? null : win.getBounds(),
    };
  }

  show(): void {
    this.nativeWindow.show();
    this.nativeWindow.focus();
    this.emit('state-changed', this.state);
  }

  hide(): void {
    this.nativeWindow.hide();
    this.emit('state-changed', this.state);
  }

  isVisible(): boolean {
    if (this.nativeWindow.isDestroyed()) {
      return false;
    }
    return this.nativeWindow.isVisible();
  }

  maximize(): void {
    this.nativeWindow.maximize();
  }

  minimize(): void {
    this.nativeWindow.minimize();
  }

  setCloseAction(action: 'quit' | 'hide'): void {
    this.closeAction = action;
  }

  destroy(): void {
    this.appSubscriptions.forEach((unsub) => unsub());
    this.appSubscriptions = [];

    this.nativeWindow.removeAllListeners();
    this.removeAllListeners();

    if (!this.nativeWindow.isDestroyed()) {
      this.nativeWindow.destroy();
    }
  }
}
