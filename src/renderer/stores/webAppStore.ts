import { create } from 'zustand';
import type { WebAppState } from '@/shared/services/webAppApi';

interface WebCatalogState {
  apps: WebAppState[];
  setApps: (apps: WebAppState[]) => void;
  addApp: (app: WebAppState) => void;
  removeApp: (id: string) => void;
  updateApp: (id: string, data: WebAppState) => void;
}

export const useWebAppStore = create<WebCatalogState>((set) => ({
  apps: [],
  setApps: (apps) => set({ apps }),
  addApp: (app) => set((state) => ({ apps: [...state.apps, app] })),
  removeApp: (id) => set((state) => ({ apps: state.apps.filter((a) => a.id !== id) })),
  updateApp: (id, data) => set((state) => ({
    apps: state.apps.map((a) => (a.id === id ? data : a)),
  })),
}));
