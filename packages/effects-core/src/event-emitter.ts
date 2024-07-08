type EventType = { [key: string]: any };

export enum EffectEventName {
  /**
   * 元素点击事件
   */
  ITEM_CLICK = 'item-click',
  /**
   * 元素消息事件
   */
  ITEM_MESSAGE = 'item-message',
  /**
   * WebGL 上下文丢失事件
   */
  WEBGL_CONTEXT_LOST = 'webgl-context-lost',
  /**
   * WebGL 上下文恢复事件
   */
  WEBGL_CONTEXT_RESTORED = 'webgl-context-restored',
  /**
   * 合成结束事件
   * 合成行为为循环时每次循环结束都会触发
   * 合成行为为销毁/冻结时只会触发一次
   */
  COMPOSITION_END = 'composition-end',
  /**
   * 播放器暂停事件
   */
  PLAY_PAUSE = 'play-pause',
}

export class EventEmitter {
  private listeners: { [K: string]: Function[] } = {};
  private onceMap = new WeakMap();
  private firstListeners = new Map<string, Function[]>();

  on (eventName: string, listener: Function): void {
    this.listeners[eventName] = this.listeners[eventName] || [];
    this.listeners[eventName].push(listener);
  }

  once (eventName: string, listener: Function): void {
    const onceWrapper = (...args: any[]) => {
      this.off(eventName, onceWrapper);
      listener.apply(this, args);
    };

    this.onceMap.set(listener, onceWrapper);
    this.on(eventName, onceWrapper);
  }

  first (eventName: string, listener: Function): void {
    this.firstListeners.set(eventName, (this.firstListeners.get(eventName) || []).concat(listener));
  }

  off (eventName: string, listener: Function): void {
    if (!this.listeners[eventName]) { return; }
    const onceWrapper = this.onceMap.get(listener);
    const index = this.listeners[eventName].indexOf(onceWrapper ?? listener);

    if (index !== -1) {
      this.listeners[eventName].splice(index, 1);
    }
    if (this.firstListeners.has(eventName)) {
      const firstIndex = this.firstListeners.get(eventName)!.indexOf(listener);

      if (firstIndex !== -1) {
        this.firstListeners.get(eventName)!.splice(firstIndex, 1);
      }
    }
  }

  emit (eventName: string, args?: EventType): void {
    const eventListeners = this.listeners[eventName];
    const firstEventListeners = this.firstListeners.get(eventName);

    if (firstEventListeners && firstEventListeners.length > 0) {
      const firstListener = firstEventListeners.shift(); // 只保留第一个监听器

      if (firstListener) {
        firstListener.apply(this, [args]);
      }
    }

    if (eventListeners) {
      eventListeners.slice().forEach(listener => {
        listener(args);
      });
    }
  }
}
