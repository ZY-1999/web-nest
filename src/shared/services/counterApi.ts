import { serviceRegistry } from '@/shared/serviceRegistry';

export abstract class CounterMainApi {
  abstract increment(): Promise<{ count: number }>;
  abstract decrement(): Promise<{ count: number }>;
}

export const counterMainApi = serviceRegistry.defineApi(CounterMainApi, 'main');
