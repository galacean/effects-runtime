/**
 *
 */
export type EventEmitterListener<P extends any[]> = (...callbackArgs: P) => void;

/**
 * 事件监听器选项
 */
export type EventEmitterOptions = {
  /**
   * 是否只监听一次
   */
  once?: boolean,
};

/**
 * 事件监听器
 */
export class EventEmitter<T extends Record<string, any[]>> {
  private listeners: Record<string, Array<{ listener: EventEmitterListener<any[]>, options?: EventEmitterOptions }>> = {};

  /**
   * 移除事件监听器
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   * @returns
   */
  off = <E extends keyof T & string> (
    eventName: E,
    listener: EventEmitterListener<T[E]>,
  ): void => {
    if (!this.listeners[eventName]) {
      return;
    }

    this.listeners[eventName] = this.listeners[eventName].filter(({ listener: l }) => l !== listener);
  };

  /**
   * 监听事件
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   * @param options - 事件监听器选项
   * @returns
   */
  on = <E extends keyof T & string> (
    eventName: E,
    listener: EventEmitterListener<T[E]>,
    options?: EventEmitterOptions,
  ) => {
    this.listeners[eventName] = this.listeners[eventName] || [];
    this.listeners[eventName].push({ listener, options });

    return () => this.off(eventName, listener);
  };

  /**
   * 一次性监听事件
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   */
  once = <E extends keyof T & string> (
    eventName: E,
    listener: EventEmitterListener<T[E]>,
  ): void => {
    this.on(eventName, listener, { once: true });
  };

  /**
   * 触发事件
   * @param eventName - 事件名称
   * @param args - 事件参数
   */
  emit = <E extends keyof T & string> (eventName: E, ...args: T[E]): void => {
    this.listeners[eventName]?.forEach(({ listener, options }) => {
      listener(...args);
      if (options?.once) {
        this.off(eventName, listener);
      }
    });
  };

  /**
   * 获取事件名称对应的所有监听器
   * @param eventName - 事件名称
   * @returns - 返回事件名称对应的所有监听器
   */
  getListeners = <E extends keyof T & string> (eventName: E): EventEmitterListener<T[E]>[] => {
    return this.listeners[eventName]?.map(({ listener }) => listener) || [];
  };
}
