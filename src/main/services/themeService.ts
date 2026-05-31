import { ThemeApi } from '@/shared/services/themeApi';
import { lightTheme, darkTheme, defaultTheme } from '@/shared/theme';
import type { ThemeTokens, ThemeMode, ThemePreset } from '@/shared/theme';
import { Singleton } from '@/shared/utils/singleton';

@Singleton()
class ThemeService extends ThemeApi {
  private currentTheme: ThemePreset = defaultTheme;

  async getThemeMode(): Promise<ThemeMode> {
    return this.currentTheme.mode;
  }

  async getTheme(): Promise<ThemeTokens> {
    return this.currentTheme.tokens;
  }

  async setTheme(mode: ThemeMode): Promise<ThemeTokens> {
    this.currentTheme = mode === 'dark' ? darkTheme : lightTheme;
    return this.currentTheme.tokens;
  }
}

export const themeService = new ThemeService();
