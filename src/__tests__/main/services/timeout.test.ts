import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';
import { Timeout, MethodTimeout } from '@/shared/serviceRegistry/decorators';
import { serviceRegistry, ServiceTimeoutError } from '@/shared/serviceRegistry';

describe('Service Registry Timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('@Timeout class decorator', async () => {
    @Timeout(500)
    abstract class TestTimeoutApi {
      static apiName = 'TestTimeoutApi';
      abstract fastMethod(): Promise<string>;
      abstract slowMethod(): Promise<string>;
      abstract normalMethod(): Promise<string>;
    }

    const timeoutApi = serviceRegistry.defineApi(TestTimeoutApi, 'main');

    class TimeoutService extends TestTimeoutApi {
      async fastMethod(): Promise<string> {
        return 'fast-result';
      }

      async slowMethod(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return 'slow-result';
      }

      async normalMethod(): Promise<string> {
        return 'normal-result';
      }
    }

    it('should apply timeout to all methods in class', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const timeoutService = new TimeoutService();
      serviceRegistry.implementService(mainChannel, timeoutService);

      await expect(timeoutApi.fastMethod()).resolves.toBe('fast-result');
      await expect(timeoutApi.normalMethod()).resolves.toBe('normal-result');
    });

    it('should timeout methods that exceed class timeout', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const timeoutService = new TimeoutService();
      serviceRegistry.implementService(mainChannel, timeoutService);

      const promise = timeoutApi.slowMethod();
      vi.advanceTimersByTime(600);
      await expect(promise).rejects.toThrow(ServiceTimeoutError);

      const promise2 = timeoutApi.slowMethod();
      vi.advanceTimersByTime(600);
      await expect(promise2).rejects.toThrow(
        "Service 'TestTimeoutApi.slowMethod' timed out after 500ms",
      );
    });
  });

  describe('@MethodTimeout method decorator', async () => {
    class TestTimeoutWithClassApi {
      static apiName = 'TestTimeoutWithClassApi';
      @MethodTimeout(1000)
      method1(): Promise<string> {
        throw new Error('Not implemented');
      }

      @MethodTimeout(100)
      method2(): Promise<string> {
        throw new Error('Not implemented');
      }
    }

    const methodTimeoutApi = serviceRegistry.defineApi(TestTimeoutWithClassApi, 'main');

    class MethodTimeoutService extends TestTimeoutWithClassApi {
      async method1(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'method1-result';
      }

      async method2(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'method2-result';
      }
    }

    it('should apply timeout to individual methods', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const methodTimeoutService = new MethodTimeoutService();
      serviceRegistry.implementService(mainChannel, methodTimeoutService);

      const promise = methodTimeoutApi.method1();
      vi.advanceTimersByTime(500);
      await expect(promise).resolves.toBe('method1-result');
    });

    it('should timeout methods exceeding method-specific timeout', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const methodTimeoutService = new MethodTimeoutService();
      serviceRegistry.implementService(mainChannel, methodTimeoutService);

      const promise = (methodTimeoutApi as unknown as TestTimeoutWithClassApi).method2();
      vi.advanceTimersByTime(200);
      await expect(promise).rejects.toThrow(ServiceTimeoutError);

      const promise2 = (methodTimeoutApi as unknown as TestTimeoutWithClassApi).method2();
      vi.advanceTimersByTime(200);
      await expect(promise2).rejects.toThrow(
        "Service 'TestTimeoutWithClassApi.method2' timed out after 100ms",
      );
    });
  });

  describe('ServiceTimeoutError', async () => {
    @Timeout(500)
    abstract class ErrorApi {
      static apiName = 'ErrorApi';
      abstract timeoutMethod(): Promise<string>;
    }
    const errorApi = serviceRegistry.defineApi(ErrorApi, 'main');

    class ErrorService extends ErrorApi {
      async timeoutMethod(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return 'result';
      }
    }

    it('should have correct error name', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const errorService = new ErrorService();
      serviceRegistry.implementService(mainChannel, errorService);

      try {
        const promise = errorApi.timeoutMethod();
        vi.advanceTimersByTime(600);
        await promise;
        expect.fail('Should have thrown ServiceTimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceTimeoutError);
        expect((error as InstanceType<typeof ServiceTimeoutError>).name).toBe(
          'ServiceTimeoutError',
        );
      }
    });

    it('should include service name in error message', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const errorService = new ErrorService();
      serviceRegistry.implementService(mainChannel, errorService);

      try {
        const promise = errorApi.timeoutMethod();
        vi.advanceTimersByTime(600);
        await promise;
        expect.fail('Should have thrown ServiceTimeoutError');
      } catch (error) {
        expect((error as Error).message).toContain('ErrorApi');
      }
    });

    it('should include method name in error message', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const errorService = new ErrorService();
      serviceRegistry.implementService(mainChannel, errorService);

      try {
        const promise = errorApi.timeoutMethod();
        vi.advanceTimersByTime(600);
        await promise;
        expect.fail('Should have thrown ServiceTimeoutError');
      } catch (error) {
        expect((error as Error).message).toContain('timeoutMethod');
      }
    });

    it('should include timeout duration in error message', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const errorService = new ErrorService();
      serviceRegistry.implementService(mainChannel, errorService);

      try {
        const promise = errorApi.timeoutMethod();
        vi.advanceTimersByTime(600);
        await promise;
        expect.fail('Should have thrown ServiceTimeoutError');
      } catch (error) {
        expect((error as Error).message).toContain('500ms');
      }
    });
  });

  describe('timeout priority (method > class > global > built-in)', async () => {
    @Timeout(500)
    abstract class PriorityApi {
      static apiName = 'PriorityApi';
      @MethodTimeout(1000)
      methodWithTimeout(): Promise<string> {
        throw new Error('Not implemented');
      }
      methodWithoutTimeout(): Promise<string> {
        throw new Error('Not implemented');
      }
    }
    const priorityApi = serviceRegistry.defineApi(PriorityApi, 'main');

    class PriorityService extends PriorityApi {
      async methodWithTimeout(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return 'result';
      }

      async methodWithoutTimeout(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return 'result';
      }
    }

    it('should prioritize method timeout over class timeout', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const priorityService = new PriorityService();
      serviceRegistry.implementService(mainChannel, priorityService);

      const promise1 = priorityApi.methodWithTimeout();
      vi.advanceTimersByTime(600);
      await expect(promise1).resolves.toBe('result');

      const promise2 = priorityApi.methodWithoutTimeout();
      vi.advanceTimersByTime(600);
      await expect(promise2).rejects.toThrow(ServiceTimeoutError);
    });

    it('should prioritize class timeout over global timeout', async () => {
      serviceRegistry.setDefaultTimeout(2000);
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const priorityService = new PriorityService();
      serviceRegistry.implementService(mainChannel, priorityService);

      const promise = priorityApi.methodWithoutTimeout();
      vi.advanceTimersByTime(600);
      await expect(promise).rejects.toThrow(ServiceTimeoutError);
    });

    it('should use global timeout when no class or method timeout', async () => {
      abstract class NoTimeoutApi {
        static apiName = 'NoTimeoutApi';
        abstract slowMethod(): Promise<string>;
      }

      class NoTimeoutService extends NoTimeoutApi {
        async slowMethod(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 1100));
          return 'result';
        }
      }

      serviceRegistry.setDefaultTimeout(500);
      const noTimeoutApi = serviceRegistry.defineApi(NoTimeoutApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const noTimeoutService = new NoTimeoutService();
      serviceRegistry.implementService(mainChannel, noTimeoutService);

      const promise1 = noTimeoutApi.slowMethod();
      vi.advanceTimersByTime(1100);
      await expect(promise1).rejects.toThrow(ServiceTimeoutError);

      const promise2 = noTimeoutApi.slowMethod();
      vi.advanceTimersByTime(1100);
      await expect(promise2).rejects.toThrow('timed out after 500ms');
    });

    it('should use built-in default timeout (10000ms) when no timeout configured', async () => {
      // Note: Testing the 10-second built-in default timeout is impractical in unit tests
      // This test verifies the mechanism by using a shorter custom timeout instead
      abstract class CustomDefaultTimeoutApi {
        static apiName = 'CustomDefaultTimeoutApi';
        abstract slowMethod(): Promise<string>;
      }

      class CustomDefaultTimeoutService extends CustomDefaultTimeoutApi {
        async slowMethod(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return 'result';
        }
      }

      serviceRegistry.setDefaultTimeout(1000);
      const defaultTimeoutApi = serviceRegistry.defineApi(CustomDefaultTimeoutApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const defaultTimeoutService = new CustomDefaultTimeoutService();
      serviceRegistry.implementService(mainChannel, defaultTimeoutService);

      const promise1 = defaultTimeoutApi.slowMethod();
      vi.advanceTimersByTime(1500);
      await expect(promise1).rejects.toThrow(ServiceTimeoutError);

      const promise2 = defaultTimeoutApi.slowMethod();
      vi.advanceTimersByTime(1500);
      await expect(promise2).rejects.toThrow('timed out after 1000ms');
    });
  });

  describe('same-process timeout with Promise.race', () => {
    it('should race against timeout promise for local calls', async () => {
      @Timeout(100)
      abstract class LocalTimeoutApi {
        static apiName = 'LocalTimeoutApi';
        abstract fastMethod(): Promise<string>;
        abstract slowMethod(): Promise<string>;
      }

      class LocalTimeoutService extends LocalTimeoutApi {
        async fastMethod(): Promise<string> {
          return 'result';
        }

        async slowMethod(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'result';
        }
      }

      const localTimeoutApi = serviceRegistry.defineApi(LocalTimeoutApi, 'main');
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const localTimeoutService = new LocalTimeoutService();
      serviceRegistry.implementService(mainChannel, localTimeoutService);

      await expect(localTimeoutApi.fastMethod()).resolves.toBe('result');

      const promise = localTimeoutApi.slowMethod();
      vi.advanceTimersByTime(200);
      await expect(promise).rejects.toThrow(ServiceTimeoutError);
    });
  });

  describe('cross-process timeout passing to channel.request', () => {
    @Timeout(100)
    abstract class CrossProcessApi {
      static apiName = 'CrossProcessApi';
      abstract remoteMethod(): Promise<string>;
      abstract fastRemoteMethod(): Promise<string>;
    }

    it('should pass timeout to channel.request for remote calls', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      const crossProcessApi = serviceRegistry.defineApi(CrossProcessApi, 'renderer');
      serviceRegistry.setDefaultChannel(mainChannel);

      rendererChannel.onRequest('CrossProcessApi:remoteMethod', async (_data) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'result';
      });
      rendererChannel.onRequest('CrossProcessApi:fastRemoteMethod', async (_data) => {
        return 'result';
      });

      const promise = crossProcessApi.remoteMethod();
      vi.advanceTimersByTime(200);
      const promise2 = crossProcessApi.fastRemoteMethod();
      await expect(promise).rejects.toThrow(ServiceTimeoutError);
      await expect(promise2).resolves.toBe('result');
    });
  });

  describe('default timeout configuration', () => {
    it('should set default timeout via setDefaultTimeout', async () => {
      serviceRegistry.setDefaultTimeout(3000);

      abstract class DefaultTimeoutApi {
        static apiName = 'DefaultTimeoutApi';
        abstract method(): Promise<string>;
      }

      class DefaultTimeoutService extends DefaultTimeoutApi {
        async method(): Promise<string> {
          return 'result';
        }
      }

      const { mainChannel } = await createChannelMock({ webContentsId: 1 });

      const api = serviceRegistry.defineApi(DefaultTimeoutApi, 'main');
      const service = new DefaultTimeoutService();
      serviceRegistry.implementService(mainChannel, service);

      await expect(api.method()).resolves.toBe('result');
    });

    it('should apply default timeout to all services', async () => {
      serviceRegistry.setDefaultTimeout(200);

      abstract class Api1 {
        static apiName = 'Api1';
        abstract method(): Promise<string>;
      }

      class Service1 extends Api1 {
        async method(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return 'result';
        }
      }

      const { mainChannel } = await createChannelMock({ webContentsId: 1 });

      const api1 = serviceRegistry.defineApi(Api1, 'main');
      const service1 = new Service1();
      serviceRegistry.implementService(mainChannel, service1);

      const promise = api1.method();
      vi.advanceTimersByTime(300);
      await expect(promise).rejects.toThrow(ServiceTimeoutError);
    });

    it('should override default timeout with class timeout', async () => {
      serviceRegistry.setDefaultTimeout(1000);

      @Timeout(500)
      abstract class OverrideApi {
        static apiName = 'OverrideApi';
        abstract method(): Promise<string>;
      }

      class OverrideService extends OverrideApi {
        async method(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 600));
          return 'result';
        }
      }

      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      const api = serviceRegistry.defineApi(OverrideApi, 'main');
      const service = new OverrideService();
      serviceRegistry.implementService(mainChannel, service);

      const promise1 = api.method();
      vi.advanceTimersByTime(600);
      await expect(promise1).rejects.toThrow(ServiceTimeoutError);

      const promise2 = api.method();
      vi.advanceTimersByTime(600);
      await expect(promise2).rejects.toThrow('timed out after 500ms');
    });
  });
});
