import { describe, it, expect } from 'vitest';
import { Singleton } from '@/shared/utils/singleton';

describe('Singleton decorator (main process)', () => {
  it('should return the same instance for multiple new calls', () => {
    @Singleton()
    class TestClass {
      constructor(public value: number) {}
    }

    const instance1 = new TestClass(1);
    const instance2 = new TestClass(2);
    const instance3 = new TestClass(3);

    expect(instance1).toBe(instance2);
    expect(instance2).toBe(instance3);
    expect(instance1.value).toBe(1); // First value kept
  });

  it('should be singleton when PROCESS_TYPE is in the list', () => {
    @Singleton('main')
    class MainOnlySingleton {
      constructor(public value: number) {}
    }

    const instance1 = new MainOnlySingleton(1);
    const instance2 = new MainOnlySingleton(2);

    expect(instance1).toBe(instance2);
  });

  it('should be singleton by default (all process types)', () => {
    @Singleton()
    class DefaultSingleton {
      constructor(public value: string) {}
    }

    const instance1 = new DefaultSingleton('first');
    const instance2 = new DefaultSingleton('second');

    expect(instance1).toBe(instance2);
    expect(instance1.value).toBe('first');
  });
});
