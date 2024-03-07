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

function generateSerializableMember (type: number, sourceName?: string) {
  return (target: any, propertyKey: any) => {
    const classStore = getDirectStore(target);

    if (!classStore[propertyKey]) {
      classStore[propertyKey] = { type: type, sourceName: sourceName };
    }
  };
}

export function serialize (sourceName?: string) {
  return generateSerializableMember(0, sourceName); // value member
}
