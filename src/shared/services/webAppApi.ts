import { serviceRegistry } from '@/shared/serviceRegistry';

export interface WebAppState {
  id: string;
  url: string;
  title: string;
  faviconUrl: string;
  faviconDataUrl?: string;
}

export abstract class WebAppMainApi {
  static apiName = 'WebAppMainApi';
  abstract createWebApp(url: string): Promise<WebAppState>;
  abstract closeWebApp(id: string): Promise<void>;
  abstract deleteWebApp(id: string): Promise<void>;
  abstract openWebApp(id: string): Promise<WebAppState>;
  abstract listWebApps(): Promise<WebAppState[]>;
  abstract updateWebApp(id: string, data: { title?: string; url?: string }): Promise<WebAppState>;
  abstract createShortcut(id: string): Promise<void>;
  abstract removeShortcut(id: string): Promise<void>;
}

export const webAppMainApi = serviceRegistry.defineApi(WebAppMainApi, 'main');
