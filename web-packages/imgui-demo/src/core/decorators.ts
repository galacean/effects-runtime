export const menuItemStore: Record<string, () => void> = {};

export function menuItem (path: string) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    menuItemStore[path] = descriptor.value;
  };
}