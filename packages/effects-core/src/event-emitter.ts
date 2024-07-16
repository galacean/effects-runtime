export type EventEmitterListener<P extends any[]> = (...callbackArgs: P) => void;

export type EventEmitterOptions = {
  once?: boolean,
};

export class EventEmitter<T extends Record<string, any[]>> {
  private _listeners: Record<string, Array<{ listener: EventEmitterListener<any[]>, options?: EventEmitterOptions }>> = {};

  off = <E extends keyof T & string>(eventName: E, listener: EventEmitterListener<T[E]>): void => {
    if (!this._listeners[eventName]) {
      return;
    }

    this._listeners[eventName] = this._listeners[eventName].filter(({ listener: l }) => l !== listener);
  };

  on = <E extends keyof T & string>(eventName: E, listener: EventEmitterListener<T[E]>, options?: EventEmitterOptions) => () => {
    this._listeners[eventName] = this._listeners[eventName] || [];
    this._listeners[eventName].push({ listener, options });

    return () => this.off(eventName, listener);
  };

  once = <E extends keyof T & string> (eventName: E, listener: EventEmitterListener<T[E]>): void => {
    this.on(eventName, listener, { once: true });
  };

  emit = <E extends keyof T & string>(eventName: E, ...args: T[E]): void => {
    this._listeners[eventName]?.forEach(({ listener, options }) => {
      listener(...args);
      if (options?.once) {
        this.off(eventName, listener);
      }
    });
  };
}
