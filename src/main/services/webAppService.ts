import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { app, session, nativeImage } from 'electron';
import { WebAppMainApi, WebAppState } from '@/shared/services';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { windowManager } from '@/main/windowManager';
import { viewManager } from '@/main/viewManager';
import { paths } from '@/main/utils/paths';
import { loadApps, saveApps } from '@/main/services/appConfigService';
import { fetchFaviconDataUrl, getCachedFaviconDataUrlSync, clearAppFaviconCache } from '@/main/services/faviconService';
import { buildPreloadArgs } from '@/shared/preload/args';
import { createDesktopShortcut, removeDesktopShortcut } from '@/main/services/shortcutService';
import { isDev } from '@/shared/utils/env';
import { getTitleBarOptions, WEBAPP_TITLEBAR_HEIGHT } from '@/shared/titlebar';
import { serviceRegistry } from '@/shared/serviceRegistry';
import { themeService } from '@/main/services/themeService';
import { WebAppWindowService } from '@/main/services/webAppWindowService';

const log = logger(__SOURCE_FILE__);

function generateWebAppId(): string {
  return `webapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

/** Load the app icon as a base64 data URL for use as default window/titlebar icon. */
let cachedDefaultIconDataUrl: string | undefined;
function loadDefaultIconDataUrl(): string | undefined {
  if (cachedDefaultIconDataUrl !== undefined) { return cachedDefaultIconDataUrl; }
  const iconPath = path.join(paths.getIconPath(), 'app', 'icon.png');
  if (fs.existsSync(iconPath)) {
    const buf = fs.readFileSync(iconPath);
    cachedDefaultIconDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  }
  return cachedDefaultIconDataUrl;
}

interface WebAppEntry {
  appId: string;
  windowId: string;
  viewId: string;
  titlebarViewId: string;
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

  /** Destroy content view + titlebar view + window resources for an in-memory entry. */
  private destroyEntry(entry: WebAppEntry) {
    viewManager.destroyView(entry.viewId);
    viewManager.destroyView(entry.titlebarViewId);
    windowManager.destroyWindow(entry.windowId);
    this.apps.delete(entry.appId);
  }

  /** Clear all session data for a web app (cookies, cache, storage). */
  private async clearAppSession(appId: string): Promise<void> {
    const ses = session.fromPartition(`persist:webapp-${appId}`);
    await ses.clearStorageData();
    await ses.clearCache();
    log.info('Session cleared for app:', appId);
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
    if (entry.isClosing) { return false; }

    const nativeWin = windowManager.getNativeWindow(entry.windowId);
    const winAlive = WebAppService.isNativeAlive(() => !!nativeWin && !nativeWin.isDestroyed());
    if (!winAlive) { return false; }

    const view = viewManager.getView(entry.viewId);
    return WebAppService.isNativeAlive(() => !!view && !view.webContents.isDestroyed());
  }

  private async createWindowForApp(
    appId: string,
    url: string,
    faviconUrl: string,
    title: string,
  ): Promise<WebAppEntry> {
    // Use cached favicon for initial icon (avoids network wait)
    const cachedFaviconDataUrl = getCachedFaviconDataUrlSync(appId);
    const initialIconDataUrl = cachedFaviconDataUrl ?? loadDefaultIconDataUrl();

    // Build initial window icon: cached favicon → NativeImage, fallback to default icon file
    const defaultIconPath = path.join(paths.getIconPath(), 'app', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
    let windowIcon: string | Electron.NativeImage = defaultIconPath;
    if (initialIconDataUrl) {
      try {
        const img = nativeImage.createFromDataURL(initialIconDataUrl);
        if (!img.isEmpty()) { windowIcon = img; }
      } catch { /* favicon format unsupported by nativeImage, fallback to file icon */ }
    }

    // Set unique AppUserModelId for independent taskbar icon (Windows)
    app.setAppUserModelId(`web-nest.webapp-${appId}`);

    const windowId = windowManager.createWindow({
      options: {
        width: 1200,
        height: 800,
        title,
        icon: windowIcon,
        ...getTitleBarOptions(),
      },
    });

    // Restore default AppUserModelId for future windows (e.g. main window)
    app.setAppUserModelId('web-nest');

    const nativeWindow = windowManager.getNativeWindow(windowId)!;
    const contentBounds = nativeWindow.getContentBounds();

    // ── Titlebar view (local renderer, 70px) ──────────────────────────────
    const titlebarUrl = isDev()
      ? 'http://localhost:5173/webapp-titlebar.html'
      : pathToFileURL(paths.getWebAppTitlebarPath()).href;

    const titlebarViewId = await viewManager.createView({
      url: titlebarUrl,
      type: 'embedded',
      preload: paths.getPreloadPath(),
      additionalArguments: buildPreloadArgs({ channelExpose: true }),
    });

    const titlebarView = viewManager.getView(titlebarViewId)!;
    titlebarView.attachTo(nativeWindow, {
      x: 0,
      y: 0,
      width: contentBounds.width,
      height: WEBAPP_TITLEBAR_HEIGHT,
    });

    // ── Content view (external URL, fills remaining space) ────────────────
    const viewId = await viewManager.createView({
      url,
      type: 'embedded',
      preload: paths.getPreloadPath(),
      additionalArguments: buildPreloadArgs({ channelExpose: false }),
      partition: `persist:webapp-${appId}`,
    });

    const view = viewManager.getView(viewId)!;
    view.attachTo(nativeWindow, {
      x: 0,
      y: WEBAPP_TITLEBAR_HEIGHT,
      width: contentBounds.width,
      height: contentBounds.height - WEBAPP_TITLEBAR_HEIGHT,
    });

    // ── Register all services on titlebar channel ────────────────────────
    // Register BEFORE fetching favicon — service must be available when titlebar renderer mounts
    const windowService = new WebAppWindowService({ contentView: view, faviconDataUrl: initialIconDataUrl });
    serviceRegistry.implementService(
      titlebarView.channel,
      themeService,
      webAppService,
      windowService,
    );

    // Fetch favicon async to refresh cache / update if no cache hit
    fetchFaviconDataUrl(appId, faviconUrl).then((dataUrl) => {
      if (!dataUrl || dataUrl === cachedFaviconDataUrl) { return; } // no change
      windowService.updateFaviconDataUrl(dataUrl);
      const wc = view.webContents;
      if (!wc.isDestroyed()) {
        // Update window taskbar icon with page favicon
        try {
          const img = nativeImage.createFromDataURL(dataUrl);
          if (!img.isEmpty()) {
            nativeWindow.setIcon(img);
          }
        } catch { /* favicon format may not be supported by nativeImage */ }
        const navState = { ...windowService.buildNavState(), faviconDataUrl: dataUrl };
        viewManager.requestTo(titlebarViewId, 'url-changed', navState).catch(() => {
          log.debug('Favicon push failed — titlebar view may be destroyed:', appId);
        });
      }
    });

    // Resize both views with window
    const managedWin = windowManager.getWindow(windowId)!;
    managedWin.on('resized', (_bounds, resizedContentBounds) => {
      if (!nativeWindow.isDestroyed()) {
        titlebarView.webContentsView.setBounds({
          x: 0,
          y: 0,
          width: resizedContentBounds.width,
          height: WEBAPP_TITLEBAR_HEIGHT,
        });
        view.webContentsView.setBounds({
          x: 0,
          y: WEBAPP_TITLEBAR_HEIGHT,
          width: resizedContentBounds.width,
          height: resizedContentBounds.height - WEBAPP_TITLEBAR_HEIGHT,
        });
      }
    });

    // Track page title updates
    view.webContents.on('page-title-updated', (_event: Electron.Event, pageTitle: string) => {
      const entry = this.apps.get(appId);
      if (entry) {
        entry.title = pageTitle;
        this.persist();
      }
    });

    // Push navigation state to titlebar on page navigation
    const pushNavState = () => {
      if (view.webContents.isDestroyed()) { return; }
      viewManager.requestTo(titlebarViewId, 'url-changed', windowService.buildNavState())
        .catch(() => { /* titlebar view may be destroyed */ });
    };
    view.webContents.on('did-navigate', pushNavState);
    view.webContents.on('did-navigate-in-page', pushNavState);

    // Track page favicon updates — use real favicon from page instead of Google service
    view.webContents.on('page-favicon-updated', (_event: Electron.Event, urls: string[]) => {
      if (!urls.length || view.webContents.isDestroyed()) { return; }
      const realFaviconUrl = urls[0];
      log.info('Page favicon updated:', appId, realFaviconUrl);
      fetchFaviconDataUrl(appId, realFaviconUrl).then((dataUrl) => {
        if (!dataUrl) { return; }
        // Update titlebar favicon
        windowService.updateFaviconDataUrl(dataUrl);
        const navState = { ...windowService.buildNavState(), faviconDataUrl: dataUrl };
        viewManager.requestTo(titlebarViewId, 'url-changed', navState).catch(() => {});
        // Update window taskbar icon
        try {
          const img = nativeImage.createFromDataURL(dataUrl);
          if (!img.isEmpty()) { nativeWindow.setIcon(img); }
        } catch { /* favicon format may not be supported by nativeImage */ }
      });
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
      // Destroy content view first, then titlebar (same order as destroyEntry)
      viewManager.destroyView(viewId);
      viewManager.destroyView(titlebarViewId);
      this.apps.delete(appId);
      windowManager.destroyWindow(windowId);
      log.info('Web app window closed:', appId);
    });

    const loadedTitle = view.webContents.getTitle() || title;

    return { appId, windowId, viewId, titlebarViewId, url, title: loadedTitle, faviconUrl };
  }

  async createWebApp(url: string): Promise<WebAppState> {
    const appId = generateWebAppId();
    const faviconUrl = googleFaviconUrl(new URL(url).hostname);

    const entry = await this.createWindowForApp(appId, url, faviconUrl, url);

    this.apps.set(appId, entry);
    this.persist();

    // Async favicon fetch already triggered in createWindowForApp; use sync cache here
    const faviconDataUrl = getCachedFaviconDataUrlSync(appId) ?? '';

    log.info('Web app created:', appId, url);
    return { id: appId, url: entry.url, title: entry.title, faviconUrl, faviconDataUrl };
  }

  async closeWebApp(id: string): Promise<void> {
    const entry = this.apps.get(id);
    if (!entry) { return; }

    this.destroyEntry(entry);
    log.info('Web app closed:', id);
  }

  async deleteWebApp(id: string): Promise<void> {
    const entry = this.apps.get(id);
    if (entry) {
      this.destroyEntry(entry);
    }

    // Remove desktop shortcut
    removeDesktopShortcut(id);

    // Remove from persisted storage
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir).filter((a) => a.id !== id);
    saveApps(configDir, persisted);

    // Clear persisted session data (cookies, localStorage, cache, etc.)
    await this.clearAppSession(id);

    // Clear per-app favicon cache
    clearAppFaviconCache(id);

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
        const faviconDataUrl = getCachedFaviconDataUrlSync(id) ?? '';
        // Trigger async refresh for uncached (fire-and-forget)
        if (!faviconDataUrl) {
          fetchFaviconDataUrl(id, existing.faviconUrl).catch(() => {});
        }
        return { id: existing.appId, url: existing.url, title: existing.title, faviconUrl: existing.faviconUrl, faviconDataUrl };
      }
      // Stale entry: window/view is closing or already destroyed
      this.apps.delete(id);
    }

    const entry = await this.createWindowForApp(id, appData.url, appData.faviconUrl, appData.title);

    this.apps.set(id, entry);

    // Async favicon fetch already triggered in createWindowForApp; use sync cache here
    const faviconDataUrl = getCachedFaviconDataUrlSync(id) ?? '';
    if (!faviconDataUrl) {
      fetchFaviconDataUrl(id, appData.faviconUrl).catch(() => {});
    }

    log.info('Web app opened:', id);
    return { id, url: entry.url, title: entry.title, faviconUrl: appData.faviconUrl, faviconDataUrl };
  }

  async listWebApps(): Promise<WebAppState[]> {
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir);

    const results: WebAppState[] = [];
    for (const app of persisted) {
      const entry = this.apps.get(app.id);
      const faviconDataUrl = getCachedFaviconDataUrlSync(app.id) ?? '';
      if (entry) {
        results.push({ id: entry.appId, url: entry.url, title: entry.title, faviconUrl: entry.faviconUrl, faviconDataUrl });
      } else {
        results.push({ ...app, faviconDataUrl });
      }
      // Trigger async fetch for uncached favicons (fire-and-forget)
      if (!faviconDataUrl) {
        fetchFaviconDataUrl(app.id, app.faviconUrl).catch(() => {});
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
      const faviconDataUrl = getCachedFaviconDataUrlSync(id) ?? '';
      if (!faviconDataUrl) {
        fetchFaviconDataUrl(id, entry.faviconUrl).catch(() => {});
      }
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
    const faviconDataUrl = getCachedFaviconDataUrlSync(id) ?? '';
    if (!faviconDataUrl) {
      fetchFaviconDataUrl(id, persisted[idx].faviconUrl).catch(() => {});
    }
    return { ...persisted[idx], faviconDataUrl };
  }

  /** Look up faviconUrl for an app from in-memory entry or persisted config. */
  private getFaviconUrlForApp(id: string): string {
    const entry = this.apps.get(id);
    if (entry) { return entry.faviconUrl; }
    const persisted = loadApps(this.getConfigDir());
    return persisted.find((a) => a.id === id)?.faviconUrl ?? '';
  }

  async getFavicon(id: string): Promise<string> {
    const cached = getCachedFaviconDataUrlSync(id);
    if (cached) { return cached; }
    // Trigger async fetch for next poll (fire-and-forget)
    const faviconUrl = this.getFaviconUrlForApp(id);
    if (faviconUrl) {
      fetchFaviconDataUrl(id, faviconUrl).catch(() => {});
    }
    return '';
  }

  async createShortcut(id: string): Promise<void> {
    const configDir = this.getConfigDir();
    const persisted = loadApps(configDir);
    const appData = persisted.find((a) => a.id === id);
    if (!appData) {
      throw new Error(`Web app not found: ${id}`);
    }
    createDesktopShortcut(id, appData.title);
    log.info('Shortcut created for:', id);
  }

  async removeShortcut(id: string): Promise<void> {
    removeDesktopShortcut(id);
    log.info('Shortcut removed for:', id);
  }
}

export const webAppService = new WebAppService();
