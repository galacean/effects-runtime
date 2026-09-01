
export type MenuItemEntry = {
  action: () => void,
  priority: number,
  shortcut: string,
};

export const menuItemStore: Record<string, MenuItemEntry> = {};

export function menuItem (path: string, options?: { priority?: number, shortcut?: string }) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    menuItemStore[path] = {
      action: descriptor.value,
      priority: options?.priority ?? 200,
      shortcut: options?.shortcut ?? '',
    };
  };
}

export const editorWindowStore: (new () => any)[] = [];
export function editorWindow () {
  return (target: any, context?: unknown) => {
    for (const editorWindowClass of editorWindowStore) {
      if (editorWindowClass === target) {
        console.warn(`Class ${target} 重复注册`);
      }
    }
    editorWindowStore.push(target);
  };
}

export const editorStore = new Map<new () => any, new () => any>();
export function editor (ComponentType: new(...args: any[]) => any,) {
  return (target: any, context?: unknown) => {
    if (editorStore.get(ComponentType)) {
      console.warn(`Editor Class ${target} 重复注册`);
    }
    editorStore.set(ComponentType, target);
  };
}
