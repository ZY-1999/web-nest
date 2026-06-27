import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { app, session, nativeImage } from 'electron';
import { WebAppMainApi, WebAppState, AppServiceConfig, ServiceState } from '@/shared/services';
import { launchServiceApp, type ServiceLaunchTarget, type ServiceLaunchHandle } from '@/main/services/serviceAppLauncher';
import { killTree, type SpawnResult } from '@/main/services/processManager';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { windowManager } from '@/main/windowManager';
import { viewManager } from '@/main/viewManager';
import { paths } from '@/main/utils/paths';
import { appConfigService } from '@/main/services/appConfigService';
import { faviconService } from '@/main/services/faviconService';
import { buildPreloadArgs } from '@/shared/preload/args';
import { shortcutService } from '@/main/services/shortcutService';
import { isDev } from '@/shared/utils/env';
import { getTitleBarOptions, WEBAPP_TITLEBAR_HEIGHT } from '@/shared/titlebar';
import { serviceRegistry } from '@/shared/serviceRegistry';
import { themeService } from '@/main/services/themeService';
import { WebAppWindowService } from '@/main/services/webAppWindowService';
import { debounce } from '@/main/utils/debounce';
import { i18nService } from '@/main/services/i18nService';
import { settingsService } from '@/main/services/settingsService';

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
  /** 服务型 app 的本地服务配置；普通型为 undefined。 */
  service?: AppServiceConfig;
  /** 服务型 app 状态机字段（Spec 04 启动协调器产物；Spec 05 清理消费）。 */
  serviceProcess?: SpawnResult | null;
  serviceState?: ServiceState;
  serviceError?: string;
  serviceCleanup?: () => void;
  isClosing?: boolean;
}

@Singleton()
export class WebAppService extends WebAppMainApi {
  private apps = new Map<string, WebAppEntry>(); // appId → entry
  private pendingOpens = new Map<string, Promise<WebAppState>>(); // appId → in-flight open
  private configDirCache: string | null = null;

  private getConfigDir(): string {
    if (!this.configDirCache) {
      this.configDirCache = paths.getConfigDir();
    }
    return this.configDirCache;
  }

  private persist() {
    const configDir = this.getConfigDir();
    const persisted = appConfigService.loadApps(configDir);
    const persistedMap = new Map(persisted.map((p) => [p.id, p]));

    // Merge: update/add open apps, keep closed apps intact
    for (const entry of this.apps.values()) {
      persistedMap.set(entry.appId, {
        id: entry.appId,
        url: entry.url,
        title: entry.title,
        faviconUrl: entry.faviconUrl,
        service: entry.service,
      });
    }

    appConfigService.saveApps(configDir, Array.from(persistedMap.values()));
  }

  /** Shell 空值兜底为 'auto'（服务型 app 持久化前归一化）。 */
  private normalizeService(service: AppServiceConfig): AppServiceConfig {
    return {
      command: service.command,
      shell: service.shell?.trim() ? service.shell : 'auto',
    };
  }

  /** 校验服务型配置：command 非空 + url 非空（持久化层双保护之一，表单层在 Spec 07）。 */
  private validateService(service: AppServiceConfig | undefined, url: string): void {
    if (!service) { return; }
    if (!service.command.trim()) {
      throw new Error(i18nService.t('errors.serviceCommandRequired'));
    }
    if (!url.trim()) {
      throw new Error(i18nService.t('errors.serviceUrlRequired'));
    }
  }

  /** Destroy content view + titlebar view + window resources for an in-memory entry. */
  private destroyEntry(entry: WebAppEntry) {
    // 服务型 app：清理启动协调器资源（定时器）
    entry.serviceCleanup?.();
    // 强杀后台进程树（Spec 05，在 content view 销毁前；killTree try-catch 保护）
    this.killServiceProcess(entry);
    viewManager.destroyView(entry.viewId);
    viewManager.destroyView(entry.titlebarViewId);
    windowManager.destroyWindow(entry.windowId);
    this.apps.delete(entry.appId);
  }

  /** 强杀单个 entry 的后台服务进程（幂等：kill 后 serviceProcess 置空，killTree 本身也 WeakSet 幂等）。 */
  private killServiceProcess(entry: WebAppEntry): void {
    if (entry.serviceProcess?.child) {
      killTree(entry.serviceProcess.child);
      entry.serviceProcess = null;
    }
  }

  /** before-quit 兜底扫杀：遍历所有服务型 app 的后台进程强杀进程树（Spec 05，AC3）。 */
  killAllServiceProcesses(): void {
    for (const entry of this.apps.values()) {
      this.killServiceProcess(entry);
    }
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
    service?: AppServiceConfig,
  ): Promise<WebAppEntry> {
    // Use cached favicon for initial icon (avoids network wait)
    const cachedFaviconDataUrl = faviconService.getCachedFaviconDataUrlSync(appId);
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

    // ── Create views: await titlebar (fast local), fire-and-forget content ──
    const titlebarUrl = isDev()
      ? 'http://localhost:5173/webapp-titlebar.html'
      : pathToFileURL(paths.getWebAppTitlebarPath()).href;

    const titlebarViewId = await viewManager.createView({
      url: titlebarUrl,
      type: 'embedded',
      preload: paths.getPreloadPath(),
      additionalArguments: buildPreloadArgs({ channelExpose: true }),
    });

    const viewId = await viewManager.createView({
      url,
      type: 'embedded',
      preload: paths.getPreloadPath(),
      additionalArguments: buildPreloadArgs({ channelExpose: false }),
      partition: `persist:webapp-${appId}`,
      waitForLoad: false,
    });

    const titlebarView = viewManager.getView(titlebarViewId)!;
    const view = viewManager.getView(viewId)!;

    // Apply proxy + userAgent to per-app session
    const appSession = session.fromPartition(`persist:webapp-${appId}`);
    await settingsService.applyProxyToSession(appSession);
    const userAgent = settingsService.getSettingsSync().userAgent;
    if (userAgent) { appSession.setUserAgent(userAgent); }

    // ── Create hidden window, attach views, then show ─────────────────────
    // Set unique AppUserModelId for independent taskbar icon (Windows)
    app.setAppUserModelId(`web-nest.webapp-${appId}`);

    const windowId = windowManager.createWindow({
      options: {
        width: 1200,
        height: 800,
        title,
        icon: windowIcon,
        show: false,
        ...getTitleBarOptions(),
      },
    });

    const nativeWindow = windowManager.getNativeWindow(windowId)!;
    const contentBounds = nativeWindow.getContentBounds();

    titlebarView.attachTo(nativeWindow, {
      x: 0,
      y: 0,
      width: contentBounds.width,
      height: WEBAPP_TITLEBAR_HEIGHT,
    });

    view.attachTo(nativeWindow, {
      x: 0,
      y: WEBAPP_TITLEBAR_HEIGHT,
      width: contentBounds.width,
      height: contentBounds.height - WEBAPP_TITLEBAR_HEIGHT,
    });

    // ── Register all services on titlebar channel ────────────────────────
    // Register BEFORE fetching favicon — service must be available when titlebar renderer mounts
    const windowService = new WebAppWindowService({ appId, contentView: view, faviconDataUrl: initialIconDataUrl });
    serviceRegistry.implementService(
      titlebarView.channel,
      themeService,
      webAppService,
      windowService,
    );

    // Window appears with views already loaded — no blank flash
    // Show BEFORE restoring AppUserModelId so Windows registers the unique taskbar icon
    nativeWindow.show();

    // Restore default AppUserModelId for future windows (e.g. main window)
    app.setAppUserModelId('web-nest');

    // Fetch favicon async to refresh cache / update if no cache hit
    faviconService.fetchFaviconDataUrl(appId, faviconUrl).then((dataUrl) => {
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

    // Track page favicon updates — debounce: only fetch the last URL in a burst
    const onFaviconUpdated = debounce((urls: string[]) => {
      if (view.webContents.isDestroyed()) { return; }
      log.info('Page favicon updated:', appId, urls[0]);
      faviconService.fetchFaviconDataUrl(appId, urls[0]).then((dataUrl) => {
        if (!dataUrl) { return; }
        windowService.updateFaviconDataUrl(dataUrl);
        const navState = { ...windowService.buildNavState(), faviconDataUrl: dataUrl };
        viewManager.requestTo(titlebarViewId, 'url-changed', navState).catch(() => {});
        try {
          const img = nativeImage.createFromDataURL(dataUrl);
          if (!img.isEmpty()) { nativeWindow.setIcon(img); }
        } catch { /* favicon format may not be supported by nativeImage */ }
      });
    }, 100);

    view.webContents.on('page-favicon-updated', (_event: Electron.Event, urls: string[]) => {
      if (!urls.length || view.webContents.isDestroyed()) { return; }
      onFaviconUpdated(urls);
    });

    // 服务型 app 启动协调器 handle（closed 时清理定时器；进程 kill 在 Spec 05 接通）
    let serviceLaunchHandle: ServiceLaunchHandle | undefined;

    // Cleanup on window close — use 'close' event (synchronous) to mark entry,
    // 'closed' event (async) to destroy resources.
    nativeWindow.on('close', () => {
      const entry = this.apps.get(appId);
      if (entry) {
        entry.isClosing = true;
      }
    });

    nativeWindow.on('closed', () => {
      const closedEntry = this.apps.get(appId);
      // 服务型 app：强杀后台进程树（Spec 05，在 content view 销毁前；killTree try-catch 保护）
      if (closedEntry) { this.killServiceProcess(closedEntry); }
      // 清理启动协调器资源（定时器）
      serviceLaunchHandle?.cleanup();
      // Destroy content view first, then titlebar (same order as destroyEntry)
      viewManager.destroyView(viewId);
      viewManager.destroyView(titlebarViewId);
      this.apps.delete(appId);
      windowManager.destroyWindow(windowId);
      log.info('Web app window closed:', appId);
    });

    const loadedTitle = view.webContents.getTitle() || title;

    // 服务型 app：spawn command + URL 自适应重试 + 状态机（Spec 04，消费 Spec 02/03）
    let initialServiceState: ServiceState | undefined;
    let initialServiceError: string | undefined;
    const entryRef: { current?: WebAppEntry } = {};
    if (service) {
      const target: ServiceLaunchTarget = {
        url,
        loadUrl: (u: string) => {
          if (!view.webContents.isDestroyed()) { return view.webContents.loadURL(u); }
        },
        onDidFailLoad: (l: () => void) => { view.webContents.on('did-fail-load', l); },
        onDidFinishLoad: (l: () => void) => { view.webContents.on('did-finish-load', l); },
        isDestroyed: () => view.webContents.isDestroyed(),
      };
      serviceLaunchHandle = await launchServiceApp(service, target, {
        onStateChange: (state, err) => {
          if (entryRef.current) {
            entryRef.current.serviceState = state;
            entryRef.current.serviceError = err;
          } else {
            initialServiceState = state;
            initialServiceError = err;
          }
          windowService.updateServiceState(state, err);
          // 推送 serviceState 到标题栏（Spec 06，复用 url-changed 通道）
          if (!view.webContents.isDestroyed()) {
            viewManager
              .requestTo(titlebarViewId, 'url-changed', windowService.buildNavState())
              .catch(() => { /* titlebar view may be destroyed */ });
          }
        },
      });
    }

    const entry: WebAppEntry = {
      appId,
      windowId,
      viewId,
      titlebarViewId,
      url,
      title: loadedTitle,
      faviconUrl,
      service,
      serviceProcess: serviceLaunchHandle?.process ?? undefined,
      serviceCleanup: serviceLaunchHandle?.cleanup,
      serviceState: initialServiceState,
      serviceError: initialServiceError,
    };
    entryRef.current = entry;
    return entry;
  }

  async createWebApp(url: string, service?: AppServiceConfig | null): Promise<WebAppState> {
    // service 存在时校验 command 非空 + url 非空；shell 空兜底为 'auto'
    const normalizedService = service ? this.normalizeService(service) : undefined;
    this.validateService(normalizedService, url);

    const appId = generateWebAppId();
    const faviconUrl = googleFaviconUrl(new URL(url).hostname);

    const entry = await this.createWindowForApp(appId, url, faviconUrl, url, normalizedService);

    this.apps.set(appId, entry);
    this.persist();

    // Async favicon fetch already triggered in createWindowForApp; use sync cache here
    const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(appId) ?? '';

    log.info('Web app created:', appId, url, normalizedService ? '(服务型)' : '(普通型)');
    return { id: appId, url: entry.url, title: entry.title, faviconUrl, faviconDataUrl, service: entry.service };
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

    // Remove desktop shortcut (now async)
    await shortcutService.removeDesktopShortcut(id);

    // Remove from persisted storage
    const configDir = this.getConfigDir();
    const persisted = appConfigService.loadApps(configDir).filter((a) => a.id !== id);
    appConfigService.saveApps(configDir, persisted);

    // Clear persisted session data (cookies, localStorage, cache, etc.)
    await this.clearAppSession(id);

    // Clear per-app favicon cache
    faviconService.clearAppFaviconCache(id);

    log.info('Web app deleted:', id);
  }

  async openWebApp(id: string): Promise<WebAppState> {
    // Deduplicate: if already opening, reuse the same promise
    const pending = this.pendingOpens.get(id);
    if (pending) { return pending; }

    const promise = this._doOpenWebApp(id);
    this.pendingOpens.set(id, promise);

    try {
      return await promise;
    } finally {
      this.pendingOpens.delete(id);
    }
  }

  private async _doOpenWebApp(id: string): Promise<WebAppState> {
    const configDir = this.getConfigDir();
    const persisted = appConfigService.loadApps(configDir);
    const appData = persisted.find((a) => a.id === id);
    if (!appData) {
      throw new Error(i18nService.t('errors.webAppNotFound', { id }));
    }

    // If already open and alive, focus the existing window and return
    if (this.apps.has(id)) {
      const existing = this.apps.get(id)!;
      if (this.isEntryAlive(existing)) {
        const nativeWin = windowManager.getNativeWindow(existing.windowId);
        if (nativeWin && !nativeWin.isDestroyed()) {
          if (nativeWin.isMinimized()) { nativeWin.restore(); }
          nativeWin.show();
          nativeWin.focus();
        }
        const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(id) ?? '';
        // Trigger async refresh for uncached (fire-and-forget)
        if (!faviconDataUrl) {
          faviconService.fetchFaviconDataUrl(id, existing.faviconUrl).catch(() => {});
        }
        return { id: existing.appId, url: existing.url, title: existing.title, faviconUrl: existing.faviconUrl, faviconDataUrl, service: existing.service };
      }
      // Stale entry: window/view is closing or already destroyed.
      // Kill any lingering service process before dropping the entry — covers the
      // narrow race where the window closed during createWindowForApp (before the
      // entry was registered), so the 'closed' handler couldn't find it to kill.
      this.killServiceProcess(existing);
      this.apps.delete(id);
    }

    const entry = await this.createWindowForApp(id, appData.url, appData.faviconUrl, appData.title, appData.service);

    this.apps.set(id, entry);

    // Async favicon fetch already triggered in createWindowForApp; use sync cache here
    const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(id) ?? '';
    if (!faviconDataUrl) {
      faviconService.fetchFaviconDataUrl(id, appData.faviconUrl).catch(() => {});
    }

    log.info('Web app opened:', id);
    return { id, url: entry.url, title: entry.title, faviconUrl: appData.faviconUrl, faviconDataUrl, service: entry.service };
  }

  async listWebApps(): Promise<WebAppState[]> {
    const configDir = this.getConfigDir();
    const persisted = appConfigService.loadApps(configDir);

    const results: WebAppState[] = [];
    for (const app of persisted) {
      const entry = this.apps.get(app.id);
      const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(app.id) ?? '';
      if (entry) {
        results.push({ id: entry.appId, url: entry.url, title: entry.title, faviconUrl: entry.faviconUrl, faviconDataUrl, service: entry.service });
      } else {
        results.push({ ...app, faviconDataUrl });
      }
      // Trigger async fetch for uncached favicons (fire-and-forget)
      if (!faviconDataUrl) {
        faviconService.fetchFaviconDataUrl(app.id, app.faviconUrl).catch(() => {});
      }
    }
    return results;
  }

  async updateWebApp(
    id: string,
    data: { title?: string; url?: string; service?: AppServiceConfig | null },
  ): Promise<WebAppState> {
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
      // service 三态：undefined=不动，null=清除（转普通型），object=设置（转服务型）
      if (data.service !== undefined) {
        const newService = data.service === null ? undefined : this.normalizeService(data.service);
        this.validateService(newService, data.url ?? entry.url);
        entry.service = newService;
      }
      this.persist();
      const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(id) ?? '';
      if (!faviconDataUrl) {
        faviconService.fetchFaviconDataUrl(id, entry.faviconUrl).catch(() => {});
      }
      return { id: entry.appId, url: entry.url, title: entry.title, faviconUrl: entry.faviconUrl, faviconDataUrl, service: entry.service };
    }

    // Update persisted-only app
    const configDir = this.getConfigDir();
    const persisted = appConfigService.loadApps(configDir);
    const idx = persisted.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(i18nService.t('errors.webAppNotFound', { id }));
    }
    if (data.title !== undefined) {
      persisted[idx].title = data.title;
    }
    if (data.url !== undefined) {
      persisted[idx].url = data.url;
      persisted[idx].faviconUrl = googleFaviconUrl(new URL(data.url).hostname);
    }
    if (data.service !== undefined) {
      if (data.service === null) {
        delete persisted[idx].service;
      } else {
        const normalized = this.normalizeService(data.service);
        this.validateService(normalized, data.url ?? persisted[idx].url);
        persisted[idx].service = normalized;
      }
    }
    appConfigService.saveApps(configDir, persisted);

    log.info('Web app updated:', id, data);
    const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(id) ?? '';
    if (!faviconDataUrl) {
      faviconService.fetchFaviconDataUrl(id, persisted[idx].faviconUrl).catch(() => {});
    }
    return { ...persisted[idx], faviconDataUrl };
  }

  /** Look up faviconUrl for an app from in-memory entry or persisted config. */
  private getFaviconUrlForApp(id: string): string {
    const entry = this.apps.get(id);
    if (entry) { return entry.faviconUrl; }
    const persisted = appConfigService.loadApps(this.getConfigDir());
    return persisted.find((a) => a.id === id)?.faviconUrl ?? '';
  }

  async getFavicon(id: string): Promise<string> {
    const cached = faviconService.getCachedFaviconDataUrlSync(id);
    if (cached) { return cached; }
    // Trigger async fetch for next poll (fire-and-forget)
    const faviconUrl = this.getFaviconUrlForApp(id);
    if (faviconUrl) {
      faviconService.fetchFaviconDataUrl(id, faviconUrl).catch(() => {});
    }
    return '';
  }

  async createShortcut(id: string): Promise<void> {
    if (!shortcutService.isShortcutSupported()) {
      throw new Error(i18nService.t('errors.shortcutNotSupported'));
    }
    const configDir = this.getConfigDir();
    const persisted = appConfigService.loadApps(configDir);
    const appData = persisted.find((a) => a.id === id);
    if (!appData) {
      throw new Error(`Web app not found: ${id}`);
    }
    const faviconDataUrl = faviconService.getCachedFaviconDataUrlSync(id);
    shortcutService.createDesktopShortcut(id, appData.title, faviconDataUrl);
    log.info('Shortcut created for:', id);
  }

  async removeShortcut(id: string): Promise<void> {
    if (!shortcutService.isShortcutSupported()) {
      throw new Error(i18nService.t('errors.shortcutNotSupported'));
    }
    await shortcutService.removeDesktopShortcut(id);
    log.info('Shortcut removed for:', id);
  }

  async hasShortcut(id: string): Promise<boolean> {
    if (!shortcutService.isShortcutSupported()) { return false; }
    return shortcutService.hasDesktopShortcut(id);
  }
}

export const webAppService = new WebAppService();
