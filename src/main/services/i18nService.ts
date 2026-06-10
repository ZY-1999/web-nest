import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import i18next from 'i18next';
import { I18nApi } from '@/shared/services/i18nApi';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { resources, normalizeLocale } from '@/shared/i18n';
import type { SupportedLocale } from '@/shared/i18n';
import { paths } from '@/main/utils/paths';
import { viewManager } from '@/main/viewManager';
import { settingsService } from '@/main/services/settingsService';

const log = logger(__SOURCE_FILE__);

const LOCALE_CONFIG_FILE = 'locale.config';

/** Migrate legacy locale.config into settings.json (called once if legacy file exists). */
function migrateLocaleConfig(): SupportedLocale | null {
  try {
    const filePath = path.join(paths.getConfigDir(), LOCALE_CONFIG_FILE);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      const locale = normalizeLocale(raw);
      if (locale) {
        // Persist to settings and remove legacy file
        settingsService.setSettingsSync({ locale });
        fs.unlinkSync(filePath);
        log.info('Migrated locale.config to settings.json, locale:', locale);
        return locale;
      }
    }
  } catch (error) {
    log.warn('Failed to migrate locale.config:', error);
  }
  return null;
}

@Singleton()
class I18nService extends I18nApi {
  private initialized = false;

  /** Initialize i18next and determine initial locale. Must be called once at startup, after settingsService.init(). */
  init(): void {
    if (this.initialized) { return; }
    this.initialized = true;

    // Priority: settings.json > migrated locale.config > system locale > default
    const saved = settingsService.getSettingsSync().locale;
    const migrated = saved ? null : migrateLocaleConfig();
    const systemLocale = normalizeLocale(app.getLocale());
    const locale = saved || migrated || systemLocale || 'en';

    i18next.init({
      resources,
      lng: locale,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });

    // Ensure settings.json has the resolved locale
    if (!saved) {
      settingsService.setSettingsSync({ locale });
    }

    log.info('i18n initialized, locale:', locale);
  }

  async getLocale(): Promise<SupportedLocale> {
    return i18next.language as SupportedLocale;
  }

  async setLocale(locale: SupportedLocale): Promise<SupportedLocale> {
    await i18next.changeLanguage(locale);
    await settingsService.setSettings({ locale });

    // Broadcast locale change to all renderer views
    try {
      await viewManager.broadcast('locale-changed', locale);
    } catch {
      // ViewManager may not have views — ignore
    }

    log.info('Locale changed to:', locale);
    return locale;
  }

  /** Expose i18next t function for main-process direct usage (tray, dialogs, etc.). */
  get t() {
    return i18next.t;
  }
}

export const i18nService = new I18nService();
