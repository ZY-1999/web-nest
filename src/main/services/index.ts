import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { updaterService } from './updaterService';
import { webAppService } from './webAppService';
import { themeService } from './themeService';

export function registerMainServices(): void {
  serviceRegistry.implementService(channel, updaterService, webAppService, themeService);
}
