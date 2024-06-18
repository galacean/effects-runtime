import { addMenuItem } from '../widgets/menu-item';

export const editorWindowStore: Record<string, any> = {};

export function EditorWindow (className: string) {
  return (target: Object, context?: unknown) => {
    if (editorWindowStore[className]) {
      console.warn(`Class ${className} 重复注册`);
    }
    editorWindowStore[className] = target;
  };
}

export function MenuItem (path: string) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    addMenuItem(path, descriptor.value);
  };
}