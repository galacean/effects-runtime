/** 获取 Demo 必需的 DOM 元素，在页面结构不匹配时尽早报错。 */
export function element<T extends HTMLElement> (id: string): T {
  const node = document.getElementById(id);

  if (!node) {
    throw new Error(`Missing demo element: ${id}`);
  }

  return node as T;
}

/** 保存 DOM 事件的解绑函数，由所属视图或应用统一释放。 */
export class DOMEvents {
  private readonly cleanups: (() => void)[] = [];

  on<T extends keyof WindowEventMap> (target: EventTarget, type: T, listener: (event: WindowEventMap[T]) => void): void {
    const callback = listener as EventListener;

    target.addEventListener(type, callback);
    this.cleanups.push(() => target.removeEventListener(type, callback));
  }

  dispose (): void {
    this.cleanups.splice(0).forEach(cleanup => cleanup());
  }
}
