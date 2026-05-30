import { describe, it, expect } from 'vitest';
import { Singleton } from '@/shared/utils/singleton';

describe('Singleton decorator (preload process)', () => {
  it('should return the same instance for multiple new calls', () => {
    @Singleton()
    class TestClass {
      constructor(public value: number) {}
    }

    const instance1 = new TestClass(1);
    const instance2 = new TestClass(2);

    expect(instance1).toBe(instance2);
  });

  it('should NOT be singleton when preload is not in the list', () => {
    @Singleton('main')
    class MainOnlySingleton {
      constructor(public value: number) {}
    }

    const instance1 = new MainOnlySingleton(1);
    const instance2 = new MainOnlySingleton(2);

    expect(instance1).not.toBe(instance2);
  });
});
