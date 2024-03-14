export interface ListenerFn<Args extends any[] = any[]> {
  (...args: Args): void,
}
export type ValidEventTypes = string | symbol | object;

export type EventNames<T extends ValidEventTypes> = T extends string | symbol
  ? T
  : keyof T;

export type ArgumentMap<T extends object> = {
  [K in keyof T]: T[K] extends (...args: any[]) => void
    ? Parameters<T[K]>
    : T[K] extends any[]
      ? T[K]
      : any[];
};

export type EventListener<
  T extends ValidEventTypes,
  K extends EventNames<T>
> = T extends string | symbol
  ? (...args: any[]) => void
  : (
    ...args: ArgumentMap<Exclude<T, string | symbol>>[Extract<K, keyof T>]
  ) => void;

export type EventArgs<
  T extends ValidEventTypes,
  K extends EventNames<T>
> = Parameters<EventListener<T, K>>;

export class EventEmitter<T extends ValidEventTypes> {
  private eventListeners: Map<EventNames<T>, ListenerFn[]> = new Map();

  on<K extends EventNames<T>>(eventName: K, listener: EventListener<T, K>): void {
    const listeners = this.eventListeners.get(eventName) || [];

    listeners.push(listener as ListenerFn);
    this.eventListeners.set(eventName, listeners);
  }

  once<K extends EventNames<T>>(eventName: K, listener: EventListener<T, K>): void {
    const onceWrapper = (...args: any[]) => {
      this.off(eventName, onceWrapper as EventListener<T, K>);
      (listener as ListenerFn)(...args);
    };

    this.on(eventName, onceWrapper as EventListener<T, K>);
  }

  off<K extends EventNames<T>>(eventName: K, listener: EventListener<T, K>): void {
    const listeners = this.eventListeners.get(eventName);

    if (!listeners) {return;}
    const index = listeners.indexOf(listener as ListenerFn);

    if (index !== -1) {
      listeners.splice(index, 1);
    }
    if (listeners.length === 0) {
      this.eventListeners.delete(eventName);
    } else {
      this.eventListeners.set(eventName, listeners);
    }
  }

  emit<K extends EventNames<T>>(eventName: K, ...args: EventArgs<T, K>): void {
    const listeners = this.eventListeners.get(eventName);

    if (!listeners) {return;}
    listeners.forEach(listener => {
      (listener as ListenerFn<EventArgs<T, K>>)(...args);
    });
  }
}
