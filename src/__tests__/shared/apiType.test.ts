import { describe, expect, it } from 'vitest';
import { serviceRegistry } from '@/shared/serviceRegistry';
import type { ApiType } from '@/shared/serviceRegistry/apiDefinitions';

abstract class TestApi {
  static apiName = 'TestApi';
  abstract syncMethod(): string;
  abstract asyncMethod(): Promise<number>;
  abstract syncMethodWithParams(arg: string): boolean;
  abstract value: string;
}

describe('ApiType with AsyncifyFunctions', () => {
  it('should ensure all methods return Promise', async () => {
    type TestApiType = ApiType<TestApi>;
    type SyncMethod = TestApiType['syncMethod'];
    type AsyncMethod = TestApiType['asyncMethod'];
    type SyncMethodWithParams = TestApiType['syncMethodWithParams'];
    type ValueType = TestApiType['value'];

    const mockSyncMethod: SyncMethod = () => Promise.resolve('test');
    const mockAsyncMethod: AsyncMethod = () => Promise.resolve(42);
    const mockSyncMethodWithParams: SyncMethodWithParams = (arg: string) =>
      Promise.resolve(arg.length > 0);
    const mockValue: ValueType = 'test';

    expect(mockSyncMethod).toBeTypeOf('function');
    expect(mockAsyncMethod).toBeTypeOf('function');
    expect(mockSyncMethodWithParams).toBeTypeOf('function');
    expect(mockValue).toBeTypeOf('string');
  });

  it('should have use method for channel switching', () => {
    const testApi = serviceRegistry.defineApi(TestApi, 'main');

    expect(testApi.use).toBeTypeOf('function');
  });
});
