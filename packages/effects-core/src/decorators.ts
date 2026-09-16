import type { Constructor } from './utils';

export const effectsClassStore: Record<string, any> = {};

export function getClass (className: string) {
  return effectsClassStore[className];
}

/**
 * Returns registered classes that directly or indirectly extend the constructor.
 * The constructor itself is excluded.
 */
export function getClassesDerivedFrom<T> (constructor: abstract new (...args: any[]) => T): Constructor<T>[] {
  const classes: Constructor<T>[] = [];

  for (const className of Object.keys(effectsClassStore)) {
    const registeredClass = effectsClassStore[className];

    if (registeredClass.prototype instanceof constructor && !classes.includes(registeredClass)) {
      classes.push(registeredClass);
    }
  }

  return classes;
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
