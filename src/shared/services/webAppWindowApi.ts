import { serviceRegistry } from '@/shared/serviceRegistry';

export interface NavigationState {
  url: string;
  title: string;
  faviconDataUrl?: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export abstract class WebAppWindowApi {
  static apiName = 'WebAppWindowApi';

  /** Get current navigation state (URL, title, favicon, back/forward availability). */
  abstract getNavState(): Promise<NavigationState>;
  /** Navigate back. */
  abstract navigateBack(): Promise<void>;
  /** Navigate forward. */
  abstract navigateForward(): Promise<void>;
  /** Reload the page. */
  abstract reload(): Promise<void>;
  /** Copy current URL to system clipboard. */
  abstract copyUrl(): Promise<void>;
}

export const webAppWindowApi = serviceRegistry.defineApi(WebAppWindowApi, 'main');
