const decoratorInitialStore = {};
const mergedStore = {};

function getDirectStore (target: any): any {
  const classKey = target.constructor.name;

  if (!(<any>decoratorInitialStore)[classKey]) {
    (<any>decoratorInitialStore)[classKey] = {};
  }

  return (<any>decoratorInitialStore)[classKey];
}

/**
 * Return the list of properties flagged as serializable
 * @param target host object
 */
export function getMergedStore (target: any): any {
  const classKey = target.constructor.name;

  if ((<any>mergedStore)[classKey]) {
    return (<any>mergedStore)[classKey];
  }

  (<any>mergedStore)[classKey] = {};

  const store = (<any>mergedStore)[classKey];
  let currentTarget = target;
  let currentKey = classKey;

  while (currentKey) {
    const initialStore = (<any>decoratorInitialStore)[currentKey];

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