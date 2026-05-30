import { describe, it, expect, beforeEach } from 'vitest';
import { useCounterStore } from '@/renderer/stores/counterStore';

describe('useCounterStore', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 });
  });

  it('should initialize with count 0', () => {
    const { count } = useCounterStore.getState();
    expect(count).toBe(0);
  });

  it('should set count to specific value', () => {
    const { setCount } = useCounterStore.getState();
    setCount(5);
    expect(useCounterStore.getState().count).toBe(5);
  });

  it('should handle multiple setCount operations', () => {
    const { setCount } = useCounterStore.getState();
    setCount(1);
    expect(useCounterStore.getState().count).toBe(1);
    
    setCount(10);
    expect(useCounterStore.getState().count).toBe(10);
    
    setCount(0);
    expect(useCounterStore.getState().count).toBe(0);
  });
});
