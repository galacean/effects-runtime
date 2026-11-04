import type { EditorWindow } from '../windows/editor-window';
import type { DetailsCustomization } from './details-customization';

export type MenuItemEntry = {
  action: () => void,
  priority: number,
  shortcut: string,
};

export const menuRegistrationStore: Record<string, MenuItemEntry> = {};

export function menuItem (path: string, options?: { priority?: number, shortcut?: string }) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    menuRegistrationStore[path] = {
      action: descriptor.value,
      priority: options?.priority ?? 200,
      shortcut: options?.shortcut ?? '',
    };
  };
}

export const editorWindowRegistry: (new () => EditorWindow)[] = [];
export function editorPanel () {
  return (target: any, context?: unknown) => {
    for (const editorWindowClass of editorWindowRegistry) {
      if (editorWindowClass === target) {
        console.warn(`Class ${target} 重复注册`);
      }
    }
    editorWindowRegistry.push(target);
  };
}

export const detailsCustomizationRegistry = new Map<Function, new () => DetailsCustomization>();
export function detailsCustomization (ComponentType: new(...args: any[]) => any,) {
  return (target: any, context?: unknown) => {
    if (detailsCustomizationRegistry.get(ComponentType)) {
      console.warn(`Editor Class ${target} 重复注册`);
    }
    detailsCustomizationRegistry.set(ComponentType, target);
  };
}

const customizationInstances = new Map<Function, DetailsCustomization>();

export function resolveDetailsCustomization (type: Function): DetailsCustomization | undefined {
  let instance = customizationInstances.get(type);
  const Customization = detailsCustomizationRegistry.get(type);

  if (!instance && Customization) { instance = new Customization(); customizationInstances.set(type, instance); }

  return instance;
}
