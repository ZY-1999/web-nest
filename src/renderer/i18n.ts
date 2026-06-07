import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from '@/shared/i18n';
import type { SupportedLocale } from '@/shared/i18n';

/**
 * Initialize i18next for the renderer process.
 * Call this before React renders, with the locale obtained from the main process via IPC.
 */
export function initI18n(locale: SupportedLocale): void {
  i18next.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

/** Change locale at runtime (e.g. on IPC broadcast from main process). */
export function changeLocale(locale: SupportedLocale): void {
  i18next.changeLanguage(locale);
}
