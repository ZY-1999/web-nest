import { describe, expect, it } from 'vitest';
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

abstract class TestApi {
  abstract testMethod(): Promise<string>;
  abstract testMethod2(param: string): Promise<number>;
}

describe('ServiceRegistry', () => {
  describe('defineApi', () => {
    it('should create API proxy with use method', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      const testServiceApi = serviceRegistry.defineApi(TestApi, 'main');

      expect(testServiceApi.use).toBeTypeOf('function');
    });

    it('should use method to create new proxy with channel', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      const testServiceApi = serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const apiWithChannel = testServiceApi.use(mainChannel);

      expect(apiWithChannel.use).toBeTypeOf('function');
    });

    it('should support chaining use calls', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      const testServiceApi = serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel: channel1 } = await createChannelMock({ webContentsId: 1 });
      const { mainChannel: channel2 } = await createChannelMock({ webContentsId: 2 });

      const api = testServiceApi.use(channel1).use(channel2);
      expect(api.use).toBeTypeOf('function');
    });
  });

  describe('implementService', () => {
    class TestService extends TestApi {
      async testMethod(): Promise<string> {
        return 'test-result';
      }

      async testMethod2(param: string): Promise<number> {
        return param.length;
      }
    }

    it('should register service implementation', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const testService = new TestService();

      expect(() => {
        serviceRegistry.implementService(mainChannel, testService);
      }).not.toThrow();
    });

    it('should throw when service does not extend defined API', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });

      class InvalidService {
        async invalidMethod(): Promise<void> {}
      }

      expect(() => {
        serviceRegistry.implementService(mainChannel, new InvalidService());
      }).toThrow('does not extend a defined API');
    });

    it('should support batch registration', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const testService = new TestService();

      expect(() => {
        serviceRegistry.implementService(mainChannel, testService, testService);
      }).not.toThrow();
    });
  });

  describe('Service invocation', () => {
    class TestService extends TestApi {
      async testMethod(): Promise<string> {
        return 'test-result';
      }

      async testMethod2(param: string): Promise<number> {
        return param.length;
      }
    }

    it('should call local implementation when process type matches', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      const testServiceApi = serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const testService = new TestService();
      serviceRegistry.implementService(mainChannel, testService);

      const result = await testServiceApi.testMethod();
      expect(result).toBe('test-result');
    });

    it('should pass arguments to local implementation', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      const testServiceApi = serviceRegistry.defineApi(TestApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const testService = new TestService();
      serviceRegistry.implementService(mainChannel, testService);

      const result = await testServiceApi.testMethod2('hello');
      expect(result).toBe(5);
    });

    it('should use specified channel for remote call', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry');
      const testServiceApi = serviceRegistry.defineApi(TestApi, 'renderer');
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('TestApi:testMethod', () => 'remote-result');

      const api = testServiceApi.use(mainChannel);
      const result = await api.testMethod();

      expect(result).toBe('remote-result');
    });
  });
});
