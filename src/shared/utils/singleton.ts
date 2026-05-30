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

type Constructor<T, P> = new (...args: P[]) => T

const singletonInstances = new WeakMap<object, unknown>();

export function Singleton<T, P>(...processTypes: ProcessType[]): (target: Constructor<T, P>) => Constructor<T, P> {
  return (target: Constructor<T, P>) => {
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

    return wrappedConstructor as Constructor<T, P>;
  };
}
