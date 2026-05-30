export interface WindowState {
  id: string;
  visible: boolean;
  focused: boolean;
  bounds: Electron.Rectangle | null;
}

export interface WindowOptions {
  id?: string;
  options?: Electron.BaseWindowConstructorOptions;
  closeAction?: 'quit' | 'hide';
}

export interface ManagedWindowEventMap {
  resized: (bounds: Electron.Rectangle, contentBounds: Electron.Rectangle) => void;
  'state-changed': (state: WindowState) => void;
}

export interface WindowEventMap {
  'window-created': (windowId: string, state: WindowState) => void;
  'window-destroyed': (windowId: string) => void;
  'window-state-changed': (windowId: string, state: WindowState) => void;
  'window-resized': (
    windowId: string,
    bounds: Electron.Rectangle,
    contentBounds: Electron.Rectangle,
  ) => void;
}
