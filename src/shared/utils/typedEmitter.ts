type Listener = (...args: never[]) => void;

export class TypedEmitter<TEvents extends { [K in keyof TEvents]: Listener }> {
  private listeners = new Map<keyof TEvents, Set<Listener>>();

  on<K extends keyof TEvents>(event: K, listener: TEvents[K]): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener);
  }

  off<K extends keyof TEvents>(event: K, listener: TEvents[K]): void {
    this.listeners.get(event)?.delete(listener as Listener);
  }

  once<K extends keyof TEvents>(event: K, listener: TEvents[K]): void {
    const wrapper = ((...args: never[]) => {
      this.off(event, wrapper as TEvents[K]);
      (listener as Listener)(...args);
    }) as TEvents[K];
    this.on(event, wrapper);
  }

  protected emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(...(args as never[]));
    }
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
