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

const log = logger(__SOURCE_FILE__);

const LOCALE_CONFIG_FILE = 'locale.config';

function readPersistedLocale(): SupportedLocale | null {
  try {
    const filePath = path.join(paths.getConfigDir(), LOCALE_CONFIG_FILE);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      return normalizeLocale(raw);
    }
  } catch {
    // Ignore read errors — fallback to system locale
  }
  return null;
}

function persistLocale(locale: SupportedLocale): void {
  try {
    const filePath = path.join(paths.getConfigDir(), LOCALE_CONFIG_FILE);
    fs.writeFileSync(filePath, locale, 'utf-8');
  } catch (error) {
    log.warn('Failed to persist locale:', error);
  }
}

@Singleton()
class I18nService extends I18nApi {
  private initialized = false;

  /** Initialize i18next and determine initial locale. Must be called once at startup. */
  init(): void {
    if (this.initialized) { return; }
    this.initialized = true;

    // Priority: persisted user preference > system locale > default
    const systemLocale = normalizeLocale(app.getLocale());
    const locale = readPersistedLocale() ?? systemLocale;

    i18next.init({
      resources,
      lng: locale,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });

    log.info('i18n initialized, locale:', locale);
  }

  async getLocale(): Promise<SupportedLocale> {
    return i18next.language as SupportedLocale;
  }

  async setLocale(locale: SupportedLocale): Promise<SupportedLocale> {
    await i18next.changeLanguage(locale);
    persistLocale(locale);

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
