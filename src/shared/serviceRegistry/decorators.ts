import { serviceMetadataRegistry } from './serviceMetadataRegistry';

export function Timeout(ms: number): ClassDecorator {
  return (target) => {
    serviceMetadataRegistry.setClassTimeout(target as unknown as abstract new () => object, ms);
  };
}

export function MethodTimeout(ms: number): MethodDecorator {
  return (target, propertyKey) => {
    if (!propertyKey) {
      return;
    }

    const constructor = target.constructor as unknown as abstract new () => object;
    serviceMetadataRegistry.setMethodTimeout(constructor, propertyKey as string, ms);
  };
}
