export const effectsClassStore: Record<string, any> = {};

export function getClass (className: string) {
  return effectsClassStore[className];
}

export function effectsClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (effectsClassStore[className]) {
      console.warn(`Class ${className} is already registered.`);
    }
    // TODO: three修改json dataType, 这边重复注册直接 return
    effectsClassStore[className] = target;
  };
}
