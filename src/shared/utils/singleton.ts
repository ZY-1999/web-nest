// Usage Example:
// @Singleton()
// class MyService { }
//
// @Singleton('main', 'renderer')
// class SharedService { }
//
// const service1 = new MyService()
// const service2 = new MyService()
// console.log(service1 === service2) // true
type ProcessType = 'main' | 'preload' | 'renderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = any> = new (...args: any[]) => T;

const singletonInstances = new WeakMap<object, unknown>();

export function Singleton(...processTypes: ProcessType[]): <T extends Constructor>(target: T) => T {
  return <T extends Constructor>(target: T) => {
    const currentProcessType = process.env.PROCESS_TYPE as ProcessType;
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType);

    if (!shouldSingleton) {
      return target; // No-op
    }

    const wrappedConstructor = new Proxy(target, {
      construct(_targetConstructor, args, newTarget) {
        const existingInstance = singletonInstances.get(target);
        if (existingInstance !== undefined) {
          return existingInstance;
        }

        const instance = Reflect.construct(target, args, newTarget);
        singletonInstances.set(target, instance);
        return instance;
      },
    });

    return wrappedConstructor as T;
  };
}
