import { CounterRendererApi } from '@/shared/services';
import { Singleton } from '@/shared/utils/singleton';
import { useCounterStore } from '../stores/counterStore';

@Singleton()
class CounterRendererService extends CounterRendererApi {
  async updateCount(count: number): Promise<void> {
    useCounterStore.setState({ count });
  }
}

export const counterRendererService = new CounterRendererService();
