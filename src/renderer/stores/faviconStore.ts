import { create } from 'zustand';
import { webAppMainApi } from '@/shared/services';

interface FaviconState {
  status: 'loading' | 'loaded';
  dataUrl?: string;
}

interface FaviconStore {
  favicons: Record<string, FaviconState>;
  requestFavicon: (appId: string) => void;
  setLoaded: (appId: string, dataUrl: string) => void;
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
          state.setLoaded(id, dataUrl);
        }
      } catch {
        // IPC may fail during app shutdown; ignore
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
    if (current?.status === 'loaded') { return; }

    // Mark as loading immediately
    set((state) => ({
      favicons: { ...state.favicons, [appId]: { status: 'loading' } },
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
      favicons: { ...state.favicons, [appId]: { status: 'loaded', dataUrl } },
    }));
  },

  dispose() {
    stopPolling();
    set({ favicons: {} });
  },
}));
