import { CounterMainApi, CounterRendererApi } from '@/shared/services';
import { Singleton } from '@/shared/utils/singleton';
import { counterRendererApi } from '@/shared/services';
import { channel } from '@/shared/channel';

@Singleton()
class CounterService extends CounterMainApi {
  private count = 0;
  private rendererApi: CounterRendererApi;

  constructor() {
    super();
    this.rendererApi = counterRendererApi.use(channel);
  }

  async increment(): Promise<{ count: number }> {
    this.count++;
    await this.notifyRenderer();
    return { count: this.count };
  }

  async decrement(): Promise<{ count: number }> {
    this.count--;
    await this.notifyRenderer();
    return { count: this.count };
  }

  private async notifyRenderer(): Promise<void> {
    try {
      await this.rendererApi.updateCount(this.count);
    } catch (error) {
      console.error('Failed to notify renderer:', error);
    }
  }
}

export const counterService = new CounterService();
