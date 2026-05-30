import type { BaseWindow } from 'electron';
import type { WindowState, ManagedWindowEventMap } from '@/shared/window';

export interface ManagedWindow {
  id: string;
  nativeWindow: BaseWindow;
  state: WindowState;
  on<K extends keyof ManagedWindowEventMap>(event: K, listener: ManagedWindowEventMap[K]): void;
  off<K extends keyof ManagedWindowEventMap>(event: K, listener: ManagedWindowEventMap[K]): void;
  once<K extends keyof ManagedWindowEventMap>(event: K, listener: ManagedWindowEventMap[K]): void;
  show(): void;
  hide(): void;
  isVisible(): boolean;
  maximize(): void;
  minimize(): void;
  setCloseAction(action: 'quit' | 'hide'): void;
  destroy(): void;
}
