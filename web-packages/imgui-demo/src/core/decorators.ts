
export const menuItemStore: Record<string, () => void> = {};

export function menuItem (path: string) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    menuItemStore[path] = descriptor.value;
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

export const objectInspectorStore = new Map<new () => any, new () => any>();
export function objectInspector (ObjectType: new(...args: any[]) => any) {
  return (target: any, context?: unknown) => {
    if (objectInspectorStore.get(ObjectType)) {
      console.warn(`ObjectInspector Class ${target} 重复注册`);
    }
    objectInspectorStore.set(ObjectType, target);
  };
}