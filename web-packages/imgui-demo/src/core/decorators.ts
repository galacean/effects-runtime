export const editorWindowStore: Record<string, any> = {};
export const menuItemStore: Record<string, () => void> = {};

export function editorWindow (className?: string) {
  return (target: any, context?: unknown) => {
    if (!className) {
      className = target.name as string;
    }
    if (editorWindowStore[className]) {
      console.warn(`Class ${className} 重复注册`);
    }
    editorWindowStore[className] = target;
  };
}

export function menuItem (path: string) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    menuItemStore[path] = descriptor.value;
  };
}