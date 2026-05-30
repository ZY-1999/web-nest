import { Singleton } from '@/shared/utils/singleton';

const SERVICE_METADATA_SYMBOL = Symbol('__serviceMetadata__');

export interface ServiceMetadata {
  serviceName: string;
  processType: 'main' | 'preload' | 'renderer';
  classTimeout?: number;
  methodTimeouts: Map<string, number>;
}

@Singleton()
export class ServiceMetadataRegistry {
  getServiceMetadata(ApiClass: abstract new () => object): ServiceMetadata | null {
    return (
      (ApiClass as unknown as Record<symbol, ServiceMetadata>)[SERVICE_METADATA_SYMBOL] ?? null
    );
  }

  ensureServiceMetadata(ApiClass: abstract new () => object): ServiceMetadata {
    const metadata = this.getServiceMetadata(ApiClass);
    if (metadata) {
      return metadata;
    }

    const newMetadata: ServiceMetadata = {
      serviceName: '',
      processType: 'main',
      methodTimeouts: new Map(),
    };
    (ApiClass as unknown as Record<symbol, ServiceMetadata>)[SERVICE_METADATA_SYMBOL] = newMetadata;
    return newMetadata;
  }

  registerService(
    ApiClass: abstract new () => object,
    serviceName: string,
    processType: 'main' | 'preload' | 'renderer',
  ): void {
    const metadata = this.ensureServiceMetadata(ApiClass);
    metadata.serviceName = serviceName;
    metadata.processType = processType;
  }

  setClassTimeout(ApiClass: abstract new () => object, timeout: number): void {
    const metadata = this.ensureServiceMetadata(ApiClass);
    metadata.classTimeout = timeout;
  }

  setMethodTimeout(ApiClass: abstract new () => object, methodName: string, timeout: number): void {
    const metadata = this.ensureServiceMetadata(ApiClass);
    metadata.methodTimeouts.set(methodName, timeout);
  }

  getEffectiveTimeout(
    ApiClass: abstract new () => object,
    methodName: string,
    defaultValue: number,
  ): number {
    const metadata = this.getServiceMetadata(ApiClass);
    if (!metadata) {
      return defaultValue;
    }

    if (metadata.methodTimeouts.has(methodName)) {
      return metadata.methodTimeouts.get(methodName)!;
    }

    return metadata.classTimeout ?? defaultValue;
  }

  findApiClass(instance: object): (abstract new () => object) | null {
    let proto = instance.constructor as unknown as abstract new () => object;
    while (proto && proto !== Function.prototype) {
      if (this.getServiceMetadata(proto)) {
        return proto;
      }
      proto = Object.getPrototypeOf(proto) as unknown as abstract new () => object;
    }
    return null;
  }

  getServiceName(ApiClass: abstract new () => object): string {
    return ApiClass.name;
  }
}

export const serviceMetadataRegistry = new ServiceMetadataRegistry();
