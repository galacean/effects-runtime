export type ClassConstructor = new (...args: unknown[]) => Object;
type PropertyDescriptor = { type?: ClassConstructor, sourceName?: string };
type SerializableMemberStoreType = Record<string, Record<string | symbol, PropertyDescriptor>>;

const decoratorInitialStore: SerializableMemberStoreType = {};
const mergedStore: SerializableMemberStoreType = {};

export const effectsClassStore: Record<string, any> = {};

export function effectsClass (className: string) {
  return (target: Object, context?: unknown) => {
    if (effectsClassStore[className]) {
      console.warn(`Class ${className} 重复注册`);
    }
    // TODO: three修改json dataType, 这边重复注册直接 return
    effectsClassStore[className] = target;
  };
}

export function serialize (type?: ClassConstructor, sourceName?: string) {
  return generateSerializableMember(type, sourceName); // value member
}

export function getMergedStore (target: Object): Record<string, any> {
  const classKey = target.constructor.name;

  if (mergedStore[classKey]) {
    return mergedStore[classKey];
  }

  mergedStore[classKey] = {};

  const store = mergedStore[classKey];
  let currentTarget = target;
  let currentKey = classKey;

  while (currentKey) {
    const initialStore = decoratorInitialStore[currentKey];

    for (const property in initialStore) {
      store[property] = initialStore[property];
    }

    const parent = Object.getPrototypeOf(currentTarget);

    currentKey = Object.getPrototypeOf(parent).constructor.name;
    if (currentKey === 'Object') {
      break;
    }
    currentTarget = parent;
  }

  return store;
}

function generateSerializableMember (type?: ClassConstructor, sourceName?: string) {
  return (target: Object, propertyKey: string | symbol) => {
    const classStore = getDirectStore(target);

    if (!classStore[propertyKey]) {
      classStore[propertyKey] = { type, sourceName };
    }
  };
}

function getDirectStore (target: Object) {
  const classKey = target.constructor.name;

  if (!decoratorInitialStore[classKey]) {
    decoratorInitialStore[classKey] = {};
  }

  return decoratorInitialStore[classKey];
}

