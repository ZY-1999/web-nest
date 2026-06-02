import { TypedEmitter } from '@/shared/utils/typedEmitter';
import { ManagedWindow } from './managedWindow';
import type { WindowOptions, WindowState, WindowEventMap } from '@/shared/window';
import { Singleton } from '@/shared/utils/singleton';

function generateWindowId(): string {
  return `win-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

@Singleton()
export class WindowManager extends TypedEmitter<WindowEventMap> {
  private windows = new Map<string, ManagedWindow>();

  createWindow(options: WindowOptions): string {
    const id = options.id ?? generateWindowId();

    if (this.windows.has(id)) {
      throw new Error(`Window ID already exists: ${id}`);
    }

    const win = new ManagedWindow(id, options);

    win.on('resized', (bounds, contentBounds) => {
      this.emit('window-resized', id, bounds, contentBounds);
    });
    win.on('state-changed', (state) => {
      this.emit('window-state-changed', id, state);
    });

    this.windows.set(id, win);

    this.emit('window-created', id, win.state);
    return id;
  }

  destroyWindow(windowId: string): void {
    const win = this.windows.get(windowId);
    if (!win) {
      return;
    }

    // Delete from map first to prevent double-destroy from reentrant calls
    this.windows.delete(windowId);
    win.destroy();
    this.emit('window-destroyed', windowId);
  }

  getWindow(windowId: string): ManagedWindow | undefined {
    return this.windows.get(windowId);
  }

  getWindowState(windowId: string): WindowState | undefined {
    return this.windows.get(windowId)?.state;
  }

  listWindows(): WindowState[] {
    return Array.from(this.windows.values()).map((w) => w.state);
  }

  getNativeWindow(windowId: string): Electron.BaseWindow | undefined {
    return this.windows.get(windowId)?.nativeWindow;
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  /** Destroy all windows and reset internal state. */
  destroy(): void {
    for (const windowId of this.windows.keys()) {
      this.destroyWindow(windowId);
    }
    this.removeAllListeners();
  }
}

export const windowManager = new WindowManager();
