type EventType = { [key: string]: any };

export class EventEmitter {
  private listeners: { [K: string]: Function[] } = {};

  on (eventName: string, listener: Function): void {
    this.listeners[eventName] = this.listeners[eventName] || [];
    this.listeners[eventName].push(listener);
  }

  // 处理一次性事件监听器
  once (eventName: string, listener: Function): void {
    // 一次性监听器的包装函数
    const onceWrapper = (...args: any[]) => {
      this.off(eventName, onceWrapper); // 移除监听器
      listener.apply(this, args); // 调用原始监听器
    };

    this.on(eventName, onceWrapper);
  }

  // 移除特定的事件监听器
  off (eventName: string, listener: Function): void {
    if (!this.listeners[eventName]) {return;}
    const index = this.listeners[eventName].indexOf(listener);

    if (index !== -1) {
      this.listeners[eventName].splice(index, 1);
    }
  }

  // 触发事件
  emit (eventName: string, args?: EventType): void {
    const eventListeners = this.listeners[eventName];

    if (eventListeners) {
      eventListeners.slice().forEach(listener => {
        listener(args);
      });
    }
  }
}
