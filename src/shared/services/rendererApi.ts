import { serviceRegistry } from '@/shared/serviceRegistry';

export abstract class CounterRendererApi {
  abstract updateCount(count: number): Promise<void>;
}

export const counterRendererApi = serviceRegistry.defineApi(CounterRendererApi, 'renderer');
