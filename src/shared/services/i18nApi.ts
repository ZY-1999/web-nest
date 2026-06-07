import { serviceRegistry } from '@/shared/serviceRegistry';
import type { SupportedLocale } from '@/shared/i18n';

export abstract class I18nApi {
  static apiName = 'I18nApi';
  abstract getLocale(): Promise<SupportedLocale>;
  abstract setLocale(locale: SupportedLocale): Promise<SupportedLocale>;
}

export const i18nApi = serviceRegistry.defineApi(I18nApi, 'main');
