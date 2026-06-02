import { WebAppMainApi, WebAppState } from '@/shared/services';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { windowManager } from '@/main/windowManager';
import { viewManager } from '@/main/viewManager';
import { paths } from '@/main/utils/paths';
import { loadApps, saveApps } from '@/main/services/appConfigService';
import { fetchFaviconDataUrl } from '@/main/services/faviconService';
import { buildPreloadArgs } from '@/shared/preload/args';

const log = logger(__SOURCE_FILE__);

function generateWebAppId(): string {
  return `webapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

interface WebAppEntry {
  appId: string;
  windowId: string;
  viewId: string;
  url: string;
  title: string;
  faviconUrl: string;
  isClosing?: boolean;
}

@Singleton()
export class WebAppService extends WebAppMainApi {
  private apps = new Map<string, WebAppEntry>(); // appId → entry
  private configDirCache: string | null = null;

  private getConfigDir(): string {
    if (!this.configDirCache) {
      this.configDirCache = paths.getConfigDir();
    }
    return this.configDirCache;
  }

  private getPersistedApps() {
    return Array.from(this.apps.values()).map((e) => ({
      id: e.appId,
      url: e.url,
      title: e.title,
      faviconUrl: e.faviconUrl,
    }));
  }

  private persist() {
    saveApps(this.getConfigDir(), this.getPersistedApps());
  }

  /** Destroy view + window resources for an in-memory entry. */
  private destroyEntry(entry: WebAppEntry) {
    viewManager.destroyView(entry.viewId);
    windowManager.destroyWindow(entry.windowId);
    this.apps.delete(entry.appId);
  }

  /** Check if a native property access is safe (returns false on destroyed or inaccessible objects). */
  private static isNativeAlive(accessor: () => boolean): boolean {
    try {
      return accessor();
    } catch {
      return false;
    }
  }

  /** Check if an entry's view and window are both alive. */
  private isEntryAlive(entry: WebAppEntry): boolean {
    if (entry.isClosing) return false;

    const nativeWin = windowManager.getNativeWindow(entry.windowId);
    const winAlive = WebAppService.isNativeAlive(() => !!nativeWin && !nativeWin.isDestroyed());
    if (!winAlive) return false;

    const view = viewManager.getView(entry.viewId);
    return WebAppService.isNativeAlive(() => !!view && !view.webContents.isDestroyed());
  }

  private async createWindowForApp(
    appId: string,
    url: string,
    faviconUrl: string,
    title: string,
  ): Promise<WebAppEntry> {
    const windowId = windowManager.createWindow({
      options: { width: 1200, height: 800, title },
    });

    const nativeWindow = windowManager.getNativeWindow(windowId)!;

    // Create view via ViewManager — external URL, preload runs but channel not exposed to page
    const viewId = await viewManager.createView({
      url,
      type: 'embedded',
      preload: paths.getPreloadPath(),
      additionalArguments: buildPreloadArgs({ channelExpose: false }),
    });

    const view = viewManager.getView(viewId)!;
    view.attachTo(nativeWindow, { ...nativeWindow.getContentBounds(), x: 0, y: 0 });

    // Resize view with window
    const managedWin = windowManager.getWindow(windowId)!;
    managedWin.on('resized', (_bounds, contentBounds) => {
      view.webContentsView.setBounds({ ...contentBounds, x: 0, y: 0 });
    });

    // Track page title updates
    view.webContents.on('page-title-updated', (_event: Electron.Event, pageTitle: string) => {
      const entry = this.apps.get(appId);
      if (entry) {
        entry.title = pageTitle;
        this.persist();
      }
    });

    // Cleanup on window close — use 'close' event (synchronous) to mark entry,
    // 'closed' event (async) to destroy resources.
    nativeWindow.on('close', () => {
      const entry = this.apps.get(appId);
      if (entry) {
        entry.isClosing = true;
      }
    });

    nativeWindow.on('closed', () => {
      viewManager.destroyView(viewId);
      this.apps.delete(appId);
      windowManager.destroyWindow(windowId);
      log.info('Web app window closed:', appId);
    });

    const loadedTitle = view.webContents.getTitle() || title;

    return { appId, windowId, viewId, url, title: loadedTitle, faviconUrl };
  }

  async createWebApp(url: string): Promise<WebAppState> {
    const appId = generateWebAppId();
    const faviconUrl = googleFaviconUrl(new URL(url).hostname);

    const entry = await this.createWindowForApp(appId, url, faviconUrl, url);

    this.apps.set(appId, entry);
    this.persist();

    const faviconDataUrl = await fetchFaviconDataUrl(faviconUrl);

    log.info('Web app created:', appId, url);
    return { id: appId, url: entry.url, title: entry.title, faviconUrl, faviconDataUrl };
  }

  async closeWebApp(id: string): Promise<void> {
    const entry = this.apps.get(id);
    if (!entry) return;

    this.destroyEntry(entry);
    log.info('Web app closed:', id);
  }

  async deleteWebApp(id: string): Promise<void> {
    const entry = this.apps.get(id);
    if (entry) {
      this.destroyEntry(entry);
    }

    // Remove from persisted storage
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir).filter((a) => a.id !== id);
    saveApps(configDir, persisted);

    log.info('Web app deleted:', id);
  }

  async openWebApp(id: string): Promise<WebAppState> {
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir);
    const appData = persisted.find((a) => a.id === id);
    if (!appData) {
      throw new Error(`Web app not found: ${id}`);
    }

    // If already open and alive, just return
    if (this.apps.has(id)) {
      const existing = this.apps.get(id)!;
      if (this.isEntryAlive(existing)) {
        const faviconDataUrl = await fetchFaviconDataUrl(existing.faviconUrl);
        return { id: existing.appId, url: existing.url, title: existing.title, faviconUrl: existing.faviconUrl, faviconDataUrl };
      }
      // Stale entry: window/view is closing or already destroyed
      this.apps.delete(id);
    }

    const entry = await this.createWindowForApp(id, appData.url, appData.faviconUrl, appData.title);

    this.apps.set(id, entry);

    const faviconDataUrl = await fetchFaviconDataUrl(appData.faviconUrl);

    log.info('Web app opened:', id);
    return { id, url: entry.url, title: entry.title, faviconUrl: appData.faviconUrl, faviconDataUrl };
  }

  async listWebApps(): Promise<WebAppState[]> {
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir);

    const results: WebAppState[] = [];
    for (const app of persisted) {
      const entry = this.apps.get(app.id);
      const faviconDataUrl = await fetchFaviconDataUrl(app.faviconUrl);
      if (entry) {
        results.push({ id: entry.appId, url: entry.url, title: entry.title, faviconUrl: entry.faviconUrl, faviconDataUrl });
      } else {
        results.push({ ...app, faviconDataUrl });
      }
    }
    return results;
  }

  async updateWebApp(id: string, data: { title?: string; url?: string }): Promise<WebAppState> {
    const entry = this.apps.get(id);
    if (entry) {
      if (data.title !== undefined) {
        entry.title = data.title;
      }
      if (data.url !== undefined && data.url !== entry.url) {
        entry.url = data.url;
        entry.faviconUrl = googleFaviconUrl(new URL(data.url).hostname);
        const view = viewManager.getView(entry.viewId);
        if (view && !view.webContents.isDestroyed()) {
          await view.webContents.loadURL(data.url);
          entry.title = view.webContents.getTitle() || data.url;
        }
      }
      this.persist();
      const faviconDataUrl = await fetchFaviconDataUrl(entry.faviconUrl);
      return { id: entry.appId, url: entry.url, title: entry.title, faviconUrl: entry.faviconUrl, faviconDataUrl };
    }

    // Update persisted-only app
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir);
    const idx = persisted.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Web app not found: ${id}`);
    }
    if (data.title !== undefined) {
      persisted[idx].title = data.title;
    }
    if (data.url !== undefined) {
      persisted[idx].url = data.url;
      persisted[idx].faviconUrl = googleFaviconUrl(new URL(data.url).hostname);
    }
    saveApps(configDir, persisted);

    log.info('Web app updated:', id, data);
    const faviconDataUrl = await fetchFaviconDataUrl(persisted[idx].faviconUrl);
    return { ...persisted[idx], faviconDataUrl };
  }
}

export const webAppService = new WebAppService();
