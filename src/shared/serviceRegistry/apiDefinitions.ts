import { ChannelTimeoutError, type ChannelLike } from '@/shared/channel';
import { AsyncifyFunctions } from '@/shared/utils/type';
import { ServiceTimeoutError } from './error';
import { serviceMetadataRegistry } from './serviceMetadataRegistry';

export type ApiType<T> = AsyncifyFunctions<T> & {
  use: (channel: ChannelLike) => ApiType<T>;
};

export const apiDefinitions = (() => {
  const BUILT_IN_DEFAULT_TIMEOUT = 10000;

  const definitions = new Map<
    abstract new () => object,
    {
      serviceName: string;
      processType: 'main' | 'preload' | 'renderer';
      apiProxy: unknown;
    }
  >();

  let defaultTimeout: number | undefined = undefined;

  let defaultChannel: ChannelLike | null = null;

  let getServiceImplementation: ((serviceName: string) => { instance: object } | undefined) | null =
    null;

  function createTimeoutPromise(service: string, method: string, ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceTimeoutError(service, method, ms));
      }, ms);
    });
  }

  function toErrorCause(error: unknown): Error | undefined {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    return undefined;
  }

  async function invokeRemote(
    channelLike: ChannelLike,
    serviceId: string,
    method: string,
    args: unknown[],
    timeout: number,
  ): Promise<unknown> {
    const channelMethod = `${serviceId}:${method}`;

    if ('request' in channelLike && typeof channelLike.request === 'function') {
      try {
        return await (channelLike as ChannelLike).request(channelMethod, args, timeout);
      } catch (e: unknown) {
        if ((e as ChannelTimeoutError).name === 'ChannelTimeoutError') {
          throw new ServiceTimeoutError(serviceId, method, timeout, toErrorCause(e));
        }
        throw e;
      }
    }

    throw new Error('Channel does not support request method');
  }

  function createApiProxy(
    serviceName: string,
    processType: 'main' | 'preload' | 'renderer',
    ApiClass: abstract new () => object,
    getServiceImplementation: (serviceName: string) => { instance: object } | undefined,
    useChannel?: ChannelLike,
  ): Record<string, unknown> {
    return new Proxy({} as Record<string, unknown>, {
      get: (target, prop) => {
        if (prop === 'use') {
          return (newChannel: ChannelLike) => {
            return createApiProxy(
              serviceName,
              processType,
              ApiClass,
              getServiceImplementation,
              newChannel,
            );
          };
        }

        if (typeof prop === 'string') {
          if (process.env.PROCESS_TYPE === processType) {
            return (...args: unknown[]) => {
              const impl = getServiceImplementation(serviceName);
              if (!impl?.instance) {
                throw new Error(`Service '${serviceName}' not implemented`);
              }
              const method = (impl.instance as Record<string, unknown>)[prop];
              if (typeof method === 'function') {
                const timeout = serviceMetadataRegistry.getEffectiveTimeout(
                  ApiClass,
                  prop,
                  defaultTimeout ?? BUILT_IN_DEFAULT_TIMEOUT,
                );
                return Promise.race([
                  (method as (...args: unknown[]) => unknown).apply(impl.instance, args),
                  createTimeoutPromise(serviceName, prop, timeout),
                ]);
              }
              return method;
            };
          } else {
            return (...args: unknown[]) => {
              const timeout = serviceMetadataRegistry.getEffectiveTimeout(
                ApiClass,
                prop,
                defaultTimeout ?? BUILT_IN_DEFAULT_TIMEOUT,
              );
              const channel = useChannel ?? defaultChannel;
              if (!channel) {
                throw new Error(
                  `No channel specified for remote service '${serviceName}'. Call .use(channel) first.`,
                );
              }
              return invokeRemote(channel, serviceName, prop, args, timeout);
            };
          }
        }

        return target[prop as never];
      },
    });
  }

  return {
    setServiceImplementationGetter(
      getter: (serviceName: string) => { instance: object } | undefined,
    ): void {
      getServiceImplementation = getter;
    },

    setDefaultTimeout(timeout: number): void {
      defaultTimeout = timeout;
    },

    setDefaultChannel(channel: ChannelLike): void {
      defaultChannel = channel;
    },

    defineApi<T extends object>(
      ApiClass: abstract new () => T,
      processType: 'main' | 'preload' | 'renderer',
    ): ApiType<T> {
      if (!getServiceImplementation) {
        throw new Error(
          'Service implementation getter not set. Call setServiceImplementationGetter first.',
        );
      }

      const serviceName = serviceMetadataRegistry.getServiceName(ApiClass);

      serviceMetadataRegistry.registerService(ApiClass, serviceName, processType);

      const apiProxy = createApiProxy(serviceName, processType, ApiClass, getServiceImplementation);

      definitions.set(ApiClass, {
        serviceName,
        processType,
        apiProxy,
      });

      return apiProxy as ApiType<T>;
    },

    find(ApiClass: abstract new () => object) {
      return definitions.get(ApiClass);
    },
  };
})();
