export * from './types';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import type { SupportedLocale } from './types';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types';

/** Raw translation resources keyed by locale. */
export const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
} as const;

/**
 * Normalize a raw locale string (e.g. from `app.getLocale()`)
 * to one of the supported locales. Falls back to `DEFAULT_LOCALE`.
 */
export function normalizeLocale(locale: string): SupportedLocale {
  if (SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  // Handle language-only codes like "zh" → "zh-CN"
  const prefix = locale.split('-')[0];
  const match = SUPPORTED_LOCALES.find((l) => l.startsWith(prefix));
  return match ?? DEFAULT_LOCALE;
}
