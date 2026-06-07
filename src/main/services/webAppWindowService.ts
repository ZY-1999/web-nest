import { clipboard } from 'electron';
import { WebAppWindowApi, type NavigationState } from '@/shared/services/webAppWindowApi';
import type { ManagedView } from '@/main/viewManager/managedView';

interface WebAppWindowContext {
  appId: string;
  contentView: ManagedView;
  faviconDataUrl?: string;
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

  updateFaviconDataUrl(dataUrl: string): void {
    this.context.faviconDataUrl = dataUrl;
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
    };
  }
}
