import { describe, expect, it } from 'vitest';
import type { AsyncifyFunctions } from '@/shared/utils/type';

describe('AsyncifyFunctions', () => {
  it('should convert sync functions to async', () => {
    interface TestInterface {
      syncMethod(): string;
      syncMethodWithParams(arg: number): boolean;
    }

    type Result = AsyncifyFunctions<TestInterface>;

    type SyncMethodType = Result['syncMethod'];
    type SyncMethodWithParamsType = Result['syncMethodWithParams'];

    const testSyncMethod: SyncMethodType = () => Promise.resolve('test');
    const testSyncMethodWithParams: SyncMethodWithParamsType = (arg: number) =>
      Promise.resolve(arg > 0);

    expect(testSyncMethod).toBeTypeOf('function');
    expect(testSyncMethodWithParams).toBeTypeOf('function');
  });

  it('should keep existing async functions unchanged', () => {
    interface TestInterface {
      asyncMethod(): Promise<number>;
      asyncMethodWithParams(s: string): Promise<boolean>;
    }

    type Result = AsyncifyFunctions<TestInterface>;

    type AsyncMethodType = Result['asyncMethod'];
    type AsyncMethodWithParamsType = Result['asyncMethodWithParams'];

    const testAsyncMethod: AsyncMethodType = () => Promise.resolve(42);
    const testAsyncMethodWithParams: AsyncMethodWithParamsType = (s: string) =>
      Promise.resolve(s.length > 0);

    expect(testAsyncMethod).toBeTypeOf('function');
    expect(testAsyncMethodWithParams).toBeTypeOf('function');
  });

  it('should keep non-function properties unchanged', () => {
    interface TestInterface {
      value: string;
      count: number;
      obj: { key: string };
    }

    type Result = AsyncifyFunctions<TestInterface>;

    type ValueType = Result['value'];
    type CountType = Result['count'];
    type ObjType = Result['obj'];

    const testValue: ValueType = 'test';
    const testCount: CountType = 42;
    const testObj: ObjType = { key: 'test' };

    expect(testValue).toBeTypeOf('string');
    expect(testCount).toBeTypeOf('number');
    expect(testObj).toBeTypeOf('object');
  });

  it('should handle mixed properties correctly', () => {
    interface TestInterface {
      syncMethod(): string;
      asyncMethod(): Promise<number>;
      value: boolean;
      nestedMethod(): { result: string };
    }

    type Result = AsyncifyFunctions<TestInterface>;

    type SyncMethodType = Result['syncMethod'];
    type AsyncMethodType = Result['asyncMethod'];
    type ValueType = Result['value'];
    type NestedMethodType = Result['nestedMethod'];

    const testSyncMethod: SyncMethodType = () => Promise.resolve('test');
    const testAsyncMethod: AsyncMethodType = () => Promise.resolve(42);
    const testValue: ValueType = true;
    const testNestedMethod: NestedMethodType = () => Promise.resolve({ result: 'test' });

    expect(testSyncMethod).toBeTypeOf('function');
    expect(testAsyncMethod).toBeTypeOf('function');
    expect(testValue).toBeTypeOf('boolean');
    expect(testNestedMethod).toBeTypeOf('function');
  });
});
