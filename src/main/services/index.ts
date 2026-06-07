import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { updaterService } from './updaterService';
import { webAppService } from './webAppService';
import { themeService } from './themeService';
import { i18nService } from './i18nService';

export function registerMainServices(): void {
  serviceRegistry.implementService(channel, updaterService, webAppService, themeService, i18nService);
}
