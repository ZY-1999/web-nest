import type { ChannelLike } from '@/shared/channel/types';
import type { ApiType } from './apiDefinitions';
import type { ServiceInfo } from './types';
import { apiDefinitions } from './apiDefinitions';
export { ServiceTimeoutError } from './error';
import { Singleton } from '@/shared/utils/singleton';
import { serviceMetadataRegistry } from './serviceMetadataRegistry';

@Singleton()
export class ServiceRegistry {
  private serviceImplementations = new Map<string, { instance: WeakRef<object>; processType: string }>();

  constructor() {
    apiDefinitions.setServiceImplementationGetter((serviceName) => {
      const entry = this.serviceImplementations.get(serviceName);
      if (!entry) {return undefined;}
      const instance = entry.instance.deref();
      if (!instance) {
        this.serviceImplementations.delete(serviceName);
        throw new Error(`Service '${serviceName}' instance has been garbage collected`);
      }
      return { instance };
    });
  }

  setDefaultChannel(channel: ChannelLike): void {
    apiDefinitions.setDefaultChannel(channel);
  }

  setDefaultTimeout(timeout: number): void {
    apiDefinitions.setDefaultTimeout(timeout);
  }

  defineApi<T extends object>(
    ApiClass: abstract new () => T,
    processType: 'main' | 'preload' | 'renderer',
  ): ApiType<T> {
    return apiDefinitions.defineApi(ApiClass, processType);
  }

  implementService(channelLike: ChannelLike | ChannelLike[], ...instances: object[]): void {
    for (const instance of instances) {
      const apiClass = serviceMetadataRegistry.findApiClass(instance);

      if (!apiClass) {
        throw new Error(
          `Service ${instance.constructor.name} does not extend a defined API. ` +
            `Ensure service extends an API class defined by defineApi.`,
        );
      }

      const metadata = serviceMetadataRegistry.getServiceMetadata(apiClass);
      if (!metadata) {
        throw new Error(`Service ${instance.constructor.name} metadata not found`);
      }

      const serviceInfo: ServiceInfo = {
        serviceName: metadata.serviceName,
        processType: metadata.processType,
      };

      this.serviceImplementations.set(serviceInfo.serviceName, {
        instance: new WeakRef(instance),
        processType: serviceInfo.processType,
      });

      const channels = Array.isArray(channelLike) ? channelLike : [channelLike];
      for (const channel of channels) {
        this.registerChannelHandlers(channel, instance, serviceInfo.serviceName);
      }
    }
  }

  private registerChannelHandlers(
    channelLike: ChannelLike,
    instance: object,
    serviceName: string,
  ): void {
    const methods = this.getServiceMethods(instance);

    for (const method of methods) {
      const methodName = method as string;
      const channelMethod = `${serviceName}:${methodName}`;
      const serviceMethod = (instance as Record<string, unknown>)[methodName];

      if (typeof serviceMethod === 'function') {
        channelLike.onRequest(channelMethod, (payload: unknown) => {
          return (serviceMethod as (...args: unknown[]) => unknown).apply(
            instance,
            payload as unknown[],
          );
        });
      }
    }
  }

  private getServiceMethods(instance: object): string[] {
    const methods: string[] = [];
    let proto = Object.getPrototypeOf(instance);
    while (proto && proto !== Object.prototype) {
      const names = Object.getOwnPropertyNames(proto);
      for (const name of names) {
        if (
          name !== 'constructor' &&
          typeof (proto as Record<string, unknown>)[name] === 'function'
        ) {
          methods.push(name);
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return methods;
  }
}

export const serviceRegistry = new ServiceRegistry();
