import { clipboard } from 'electron';
import { WebAppWindowApi, type NavigationState } from '@/shared/services/webAppWindowApi';
import type { ServiceState } from '@/shared/services/webAppApi';
import type { ManagedView } from '@/main/viewManager/managedView';

interface WebAppWindowContext {
  appId: string;
  contentView: ManagedView;
  faviconDataUrl?: string;
  /** 服务型 app 状态机存储（Spec 04 预埋；Spec 06 让 buildNavState 带上推送标题栏）。 */
  serviceState?: ServiceState;
  serviceError?: string;
}

/**
 * Per-view service for web app window titlebar.
 * Each web app window creates its own instance with a captured content view reference.
 */
export class WebAppWindowService extends WebAppWindowApi {
  private context: WebAppWindowContext;

  constructor(context: WebAppWindowContext) {
    super();
    this.context = context;
  }

  async getNavState(): Promise<NavigationState> {
    return this.buildNavState();
  }

  async navigateBack(): Promise<void> {
    const wc = this.context.contentView.webContents;
    if (!wc.isDestroyed()) { wc.goBack(); }
  }

  async navigateForward(): Promise<void> {
    const wc = this.context.contentView.webContents;
    if (!wc.isDestroyed()) { wc.goForward(); }
  }

  async reload(): Promise<void> {
    const wc = this.context.contentView.webContents;
    if (!wc.isDestroyed()) { wc.reload(); }
  }

  async copyUrl(): Promise<void> {
    const wc = this.context.contentView.webContents;
    if (!wc.isDestroyed()) { clipboard.writeText(wc.getURL()); }
  }

  async toggleDevTools(): Promise<void> {
    const wc = this.context.contentView.webContents;
    if (!wc.isDestroyed()) { this.context.contentView.toggleDevTools(); }
  }

  updateFaviconDataUrl(dataUrl: string): void {
    this.context.faviconDataUrl = dataUrl;
  }

  /** 更新服务型 app 状态（由 webAppService 经 serviceAppLauncher 回调调用）。 */
  updateServiceState(state: ServiceState, error?: string): void {
    this.context.serviceState = state;
    this.context.serviceError = error;
  }

  /** Build navigation state payload from content view webContents. */
  buildNavState(): NavigationState {
    const wc = this.context.contentView.webContents;
    if (wc.isDestroyed()) {
      return { appId: this.context.appId, url: '', title: '', canGoBack: false, canGoForward: false };
    }
    return {
      appId: this.context.appId,
      url: wc.getURL(),
      title: wc.getTitle(),
      faviconDataUrl: this.context.faviconDataUrl,
      canGoBack: wc.navigationHistory?.canGoBack() ?? false,
      canGoForward: wc.navigationHistory?.canGoForward() ?? false,
      serviceState: this.context.serviceState,
      serviceError: this.context.serviceError,
    };
  }
}
