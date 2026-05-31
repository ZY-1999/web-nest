import { serviceRegistry } from '@/shared/serviceRegistry';

export interface WebAppState {
  id: string;
  url: string;
  title: string;
}

export abstract class WebAppMainApi {
  static apiName = 'WebAppMainApi';
  abstract createWebApp(url: string): Promise<WebAppState>;
  abstract closeWebApp(id: string): Promise<void>;
  abstract listWebApps(): Promise<WebAppState[]>;
  abstract updateWebApp(id: string, data: { title?: string; url?: string }): Promise<WebAppState>;
}

export const webAppMainApi = serviceRegistry.defineApi(WebAppMainApi, 'main');
