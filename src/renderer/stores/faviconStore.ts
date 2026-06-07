import { create } from 'zustand';
import { webAppMainApi } from '@/shared/services';

const MAX_RETRIES = 10; // 10 × 2s = 20s max wait before giving up

interface FaviconState {
  status: 'loading' | 'loaded' | 'error';
  dataUrl?: string;
  retryCount: number;
}

interface FaviconStore {
  favicons: Record<string, FaviconState>;
  requestFavicon: (appId: string) => void;
  setLoaded: (appId: string, dataUrl: string) => void;
  failRetry: (appId: string) => void;
  dispose: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollTimer) { return; }
  pollTimer = setInterval(async () => {
    const state = useFaviconStore.getState();
    const loadingIds = Object.entries(state.favicons)
      .filter(([, v]) => v.status === 'loading')
      .map(([id]) => id);

    if (loadingIds.length === 0) {
      stopPolling();
      return;
    }

    for (const id of loadingIds) {
      try {
        const dataUrl = await webAppMainApi.getFavicon(id);
        if (dataUrl) {
          useFaviconStore.getState().setLoaded(id, dataUrl);
        } else {
          useFaviconStore.getState().failRetry(id);
        }
      } catch {
        useFaviconStore.getState().failRetry(id);
      }
    }
  }, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export const useFaviconStore = create<FaviconStore>((set, get) => ({
  favicons: {},

  requestFavicon(appId: string) {
    const current = get().favicons[appId];
    // Skip if already loaded or actively loading (polling handles retries)
    if (current?.status === 'loaded' || current?.status === 'loading') { return; }

    // Mark as loading immediately (also resets from error state)
    set((state) => ({
      favicons: { ...state.favicons, [appId]: { status: 'loading', retryCount: 0 } },
    }));

    // Immediate IPC call for fast cache hit
    webAppMainApi.getFavicon(appId).then((dataUrl) => {
      if (dataUrl) {
        get().setLoaded(appId, dataUrl);
      } else {
        // Not cached yet — start polling
        startPolling();
      }
    }).catch(() => {
      // IPC may fail; polling will retry
      startPolling();
    });
  },

  setLoaded(appId: string, dataUrl: string) {
    set((state) => ({
      favicons: { ...state.favicons, [appId]: { status: 'loaded', dataUrl, retryCount: 0 } },
    }));
  },

  failRetry(appId: string) {
    const current = get().favicons[appId];
    if (!current || current.status !== 'loading') { return; }
    const newCount = current.retryCount + 1;
    if (newCount >= MAX_RETRIES) {
      set((state) => ({
        favicons: { ...state.favicons, [appId]: { status: 'error', dataUrl: undefined, retryCount: newCount } },
      }));
    } else {
      set((state) => ({
        favicons: { ...state.favicons, [appId]: { ...state.favicons[appId], retryCount: newCount } },
      }));
    }
  },

  dispose() {
    stopPolling();
    set({ favicons: {} });
  },
}));
