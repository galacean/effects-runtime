export const effectsClassStore: Record<string, any> = {};
const decoratorInitialStore: Record<string, any> = {};
const mergedStore: Record<string, any> = {};

function getDirectStore (target: any) {
  const classKey = target.constructor.name;

  if (!(decoratorInitialStore)[classKey]) {
    (decoratorInitialStore)[classKey] = {};
  }

  return decoratorInitialStore[classKey];
}

export function getMergedStore (target: any): any {
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

export function serialize (type?: string, sourceName?: string) {
  return generateSerializableMember(type, sourceName); // value member
}

export function effectsClass (className: any) {
  return (target: any, context?: any) => {
    if (effectsClassStore[className]) {
      console.warn('Class ' + className + ' 重复注册');
    }
    //TODO: three修改json dataType, 这边重复注册直接 return
    effectsClassStore[className] = target;
  };
}

function generateSerializableMember (type?: string, sourceName?: string) {
  return (target: any, propertyKey: any) => {
    const classStore = getDirectStore(target);

    if (!classStore[propertyKey]) {
      classStore[propertyKey] = { type: type, sourceName: sourceName };
    }
  };
}
