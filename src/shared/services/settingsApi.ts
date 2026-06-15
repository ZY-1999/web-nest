import { serviceRegistry } from '@/shared/serviceRegistry';
import type { AppSettings, SettingsPatch } from '@/shared/settings';

export interface ProxyTestResult {
  ok: boolean;
  latency?: number;
  error?: string;
}

export interface ProxyTestConfig {
  mode: 'none' | 'http' | 'socks5';
  host: string;
  port: number;
}

export abstract class SettingsApi {
  static apiName = 'SettingsApi';
  abstract getSettings(): Promise<AppSettings>;
  abstract setSettings(patch: SettingsPatch): Promise<AppSettings>;
  abstract testProxy(config: ProxyTestConfig): Promise<ProxyTestResult>;
}

export const settingsApi = serviceRegistry.defineApi(SettingsApi, 'main');
