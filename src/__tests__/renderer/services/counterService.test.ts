import { describe, it, expect, beforeEach } from 'vitest';
import { counterRendererService } from '@/renderer/services/counterService';
import { useCounterStore } from '@/renderer/stores/counterStore';

describe('CounterRendererService', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 });
  });

  it('should update store count when updateCount is called', async () => {
    await counterRendererService.updateCount(5);
    expect(useCounterStore.getState().count).toBe(5);
  });

  it('should handle multiple updates correctly', async () => {
    await counterRendererService.updateCount(1);
    expect(useCounterStore.getState().count).toBe(1);
    
    await counterRendererService.updateCount(10);
    expect(useCounterStore.getState().count).toBe(10);
  });
});
