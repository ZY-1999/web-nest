import { serviceRegistry } from '@/shared/serviceRegistry';
import type { AppSettings, SettingsPatch } from '@/shared/settings';

export abstract class SettingsApi {
  static apiName = 'SettingsApi';
  abstract getSettings(): Promise<AppSettings>;
  abstract setSettings(patch: SettingsPatch): Promise<AppSettings>;
}

export const settingsApi = serviceRegistry.defineApi(SettingsApi, 'main');
