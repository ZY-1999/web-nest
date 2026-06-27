import { serviceRegistry } from '@/shared/serviceRegistry';
import type { ServiceState } from './webAppApi';

export interface NavigationState {
  appId?: string;
  url: string;
  title: string;
  faviconDataUrl?: string;
  canGoBack: boolean;
  canGoForward: boolean;
  /** 服务型 app 状态（Spec 06；普通型 undefined → 标题栏不渲染指示器）。 */
  serviceState?: ServiceState;
  serviceError?: string;
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
  /** Toggle DevTools on the content view. */
  abstract toggleDevTools(): Promise<void>;
}

export const webAppWindowApi = serviceRegistry.defineApi(WebAppWindowApi, 'main');
