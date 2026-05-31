import { serviceRegistry } from '@/shared/serviceRegistry';
import type { ThemeTokens, ThemeMode } from '@/shared/theme';

export abstract class ThemeApi {
  static apiName = 'ThemeApi';
  abstract getThemeMode(): Promise<ThemeMode>;
  abstract getTheme(): Promise<ThemeTokens>;
  abstract setTheme(mode: ThemeMode): Promise<ThemeTokens>;
}

export const themeApi = serviceRegistry.defineApi(ThemeApi, 'main');
