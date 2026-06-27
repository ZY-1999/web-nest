import { serviceRegistry } from '@/shared/serviceRegistry';

/** 服务型 web app 的本地后端服务配置（command 仅落盘，真正执行在 Spec 04）。 */
export interface AppServiceConfig {
  command: string;
  shell: string;
}

/** 服务型 app 后端服务的运行时状态（CONTEXT.md 领域词汇；Spec 04 状态机 + Spec 06 标题栏指示）。 */
export type ServiceState = 'idle' | 'starting' | 'running' | 'failed' | 'stopped';

export interface WebAppState {
  id: string;
  url: string;
  title: string;
  faviconUrl: string;
  faviconDataUrl?: string;
  /** 服务型 app 的本地服务配置；普通型为 undefined。 */
  service?: AppServiceConfig;
}

export abstract class WebAppMainApi {
  static apiName = 'WebAppMainApi';
  /**
   * 创建 web app。传 service（{command,shell}）= 服务型；不传/传 null = 普通型。
   * service 存在时校验 command 非空；shell 空兜底为 'auto'。
   */
  abstract createWebApp(url: string, service?: AppServiceConfig | null): Promise<WebAppState>;
  abstract closeWebApp(id: string): Promise<void>;
  abstract deleteWebApp(id: string): Promise<void>;
  abstract openWebApp(id: string): Promise<WebAppState>;
  abstract listWebApps(): Promise<WebAppState[]>;
  /**
   * 更新 web app。data.service 三态语义：
   * - undefined = 不动（保持原样）
   * - null = 清除（转普通型）
   * - object = 设置/覆盖（转服务型）
   */
  abstract updateWebApp(
    id: string,
    data: { title?: string; url?: string; service?: AppServiceConfig | null },
  ): Promise<WebAppState>;
  abstract getFavicon(id: string): Promise<string>;
  abstract createShortcut(id: string): Promise<void>;
  abstract removeShortcut(id: string): Promise<void>;
  abstract hasShortcut(id: string): Promise<boolean>;
}

export const webAppMainApi = serviceRegistry.defineApi(WebAppMainApi, 'main');
