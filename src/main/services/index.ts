import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { updaterService } from './updaterService';
import { counterService } from './counterService';
import { webAppService } from './webAppService';

export function registerMainServices(): void {
  serviceRegistry.implementService(channel, updaterService, counterService, webAppService);
}
