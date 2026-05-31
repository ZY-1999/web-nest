import { create } from 'zustand';

interface WebApp {
  id: string;
  url: string;
  title: string;
}

interface WebCatalogState {
  apps: WebApp[];
  setApps: (apps: WebApp[]) => void;
  addApp: (app: WebApp) => void;
  removeApp: (id: string) => void;
  updateApp: (id: string, data: Partial<WebApp>) => void;
}

export const useWebAppStore = create<WebCatalogState>((set) => ({
  apps: [],
  setApps: (apps) => set({ apps }),
  addApp: (app) => set((state) => ({ apps: [...state.apps, app] })),
  removeApp: (id) => set((state) => ({ apps: state.apps.filter((a) => a.id !== id) })),
  updateApp: (id, data) => set((state) => ({
    apps: state.apps.map((a) => (a.id === id ? { ...a, ...data } : a)),
  })),
}));
