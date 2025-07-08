import type { Constructor } from './utils';

type PropertyDescriptor = { type?: Constructor, sourceName?: string };
type SerializableMemberStoreType = Map<Function, Record<string | symbol, PropertyDescriptor>>;

const decoratorInitialStore: SerializableMemberStoreType = new Map();
const mergedStore: SerializableMemberStoreType = new Map();

export const effectsClassStore: Record<string, any> = {};

/**
 * Retrieves the class registered under the specified class name.
 *
 * @param className - The name of the registered class to retrieve
 * @returns The class constructor or object associated with `className`, or `undefined` if not found
 */
export function getClass (className: string) {
  return effectsClassStore[className];
}

/**
 * Class decorator factory that registers the decorated class under the specified name for later retrieval.
 *
 * If a class with the same name is already registered, a warning is logged and the registration is overwritten.
 *
 * @param className - The name under which to register the class
 * @returns A class decorator function
 */
export function effectsClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (effectsClassStore[className]) {
      console.warn(`Class ${className} is already registered.`);
    }
    // TODO: three修改json dataType, 这边重复注册直接 return
    effectsClassStore[className] = target;
  };
}

export function serialize (type?: Constructor, sourceName?: string) {
  return generateSerializableMember(type, sourceName); // value member
}

export function getMergedStore (target: Object): Record<string, any> | undefined {
  const classKey = target.constructor;

  if (mergedStore.get(classKey)) {
    return mergedStore.get(classKey);
  }

  const store: Record<string | symbol, PropertyDescriptor> = {};

  mergedStore.set(classKey, store);

  let currentTarget = target;
  let currentKey = classKey;

  while (currentKey) {
    const initialStore = decoratorInitialStore.get(currentKey);

    for (const property in initialStore) {
      store[property] = initialStore[property];
    }

    const parent = Object.getPrototypeOf(currentTarget);

    currentKey = Object.getPrototypeOf(parent).constructor;
    if (currentKey === Object) {
      break;
    }
    currentTarget = parent;
  }

  return store;
}

function generateSerializableMember (type?: Constructor, sourceName?: string) {
  return (target: Object, propertyKey: string | symbol) => {
    const classStore = getDirectStore(target);

    if (!classStore) {
      return;
    }
    if (!classStore[propertyKey]) {
      classStore[propertyKey] = { type, sourceName };
    }
  };
}

function getDirectStore (target: Object) {
  const classKey = target.constructor;

  if (!decoratorInitialStore.get(classKey)) {
    decoratorInitialStore.set(classKey, {});
  }

  return decoratorInitialStore.get(classKey);
}

