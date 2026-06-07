/** Supported locale identifiers. Extend this union to add new languages. */
export type SupportedLocale = 'en' | 'zh-CN';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'zh-CN'];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
