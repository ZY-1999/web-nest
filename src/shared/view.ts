import type { Channel } from '@/shared/channel';

export type ViewType = 'embedded' | 'detached' | 'offscreen';

export interface ViewState {
  id: string;
  type: ViewType;
  url: string;
  bounds: Electron.Rectangle | null;
  visible: boolean;
  focused: boolean;
  loaded: boolean;
}

export type ViewOptions = Electron.WebPreferences & {
  url: string;
  id?: string;
  type?: ViewType;
  bounds?: Electron.Rectangle;
  channel?: Channel;
  defaultChannelTimeout?: number;
  loadUrlOptions?: Electron.LoadURLOptions;
  backgroundColor?: string;
  /** If false, createView resolves immediately after channel init without waiting for did-finish-load. */
  waitForLoad?: boolean;
};

export interface ManagedViewEventMap {
  'state-changed': (state: ViewState) => void;
  ready: () => void;
}

export interface ViewEventMap {
  'view-created': (viewId: string, state: ViewState) => void;
  'view-destroyed': (viewId: string) => void;
  'view-state-changed': (viewId: string, state: ViewState) => void;
  'view-ready': (viewId: string) => void;
}
