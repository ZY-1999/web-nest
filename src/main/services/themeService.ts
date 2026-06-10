import { ThemeApi } from '@/shared/services/themeApi';
import { lightTheme, darkTheme, defaultTheme } from '@/shared/theme';
import type { ThemeTokens, ThemeMode, ThemePreset } from '@/shared/theme';
import { Singleton } from '@/shared/utils/singleton';
import { settingsService } from '@/main/services/settingsService';

@Singleton()
class ThemeService extends ThemeApi {
  private currentTheme: ThemePreset = defaultTheme;

  /** Restore theme from persisted settings. Call after settingsService.init(). */
  init(): void {
    const saved = settingsService.getSettingsSync().theme;
    if (saved === 'dark') {
      this.currentTheme = darkTheme;
    } else {
      this.currentTheme = lightTheme;
    }
  }

  async getThemeMode(): Promise<ThemeMode> {
    return this.currentTheme.mode;
  }

  async getTheme(): Promise<ThemeTokens> {
    return this.currentTheme.tokens;
  }

  async setTheme(mode: ThemeMode): Promise<ThemeTokens> {
    this.currentTheme = mode === 'dark' ? darkTheme : lightTheme;
    await settingsService.setSettings({ theme: mode });
    return this.currentTheme.tokens;
  }
}

export const themeService = new ThemeService();
