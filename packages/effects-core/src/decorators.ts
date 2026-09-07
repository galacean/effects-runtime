import type { Constructor } from './utils';

export const effectsClassStore: Record<string, Constructor> = {};
const effectsClassNames = new WeakMap<Constructor, string>();

export function getClass<T = unknown> (className: string): Constructor<T> | undefined {
  return effectsClassStore[className] as Constructor<T> | undefined;
}

export function effectsClass (className: string) {
  return <T extends Constructor> (target: T, context?: unknown) => {
    if (effectsClassStore[className]) {
      console.warn(`Class ${className} is already registered.`);
    }
    // Rendering backends intentionally replace core registrations with their
    // concrete implementations when their entry module is evaluated.
    effectsClassStore[className] = target;
    effectsClassNames.set(target, className);
  };
}

export function getEffectsClassName (target: Constructor): string | undefined {
  return effectsClassNames.get(target);
}
