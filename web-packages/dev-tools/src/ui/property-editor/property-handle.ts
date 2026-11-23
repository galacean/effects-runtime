export type PropertyMutationHandler = (object: object, key: PropertyKey, action: () => void) => void;
let mutationHandler: PropertyMutationHandler | undefined;

export function registerPropertyMutationHandler (handler: PropertyMutationHandler): void { mutationHandler = handler; }

export interface ReflectedProperty {
  key: PropertyKey,
  value: unknown,
  writable: boolean,
  error?: string,
}

export class PropertyHandle<T = unknown> {
  constructor (readonly owner: object, readonly key: PropertyKey, readonly label = String(key), readonly writable = true) { }

  get value (): T { return Reflect.get(this.owner, this.key) as T; }

  set (value: T): void {
    if (this.writable) { this.mutate(() => { Reflect.set(this.owner, this.key, value); }); }
  }

  access = (next?: T): T => {
    if (next !== undefined) { this.set(next); }

    return this.value;
  };

  mutate<R> (action: () => R): R {
    let result: R;
    const apply = () => { result = action(); };

    if (mutationHandler) { mutationHandler(this.owner, this.key, apply); } else { apply(); }

    return result!;
  }
}

export function reflectProperties (object: object, inherited = false): ReflectedProperty[] {
  const result: ReflectedProperty[] = [], seen = new Set<PropertyKey>();
  let owner: object | null = object;

  while (owner && owner !== Object.prototype) {
    const keys = inherited ? Reflect.ownKeys(owner) : Object.keys(owner);

    for (const key of keys) {
      if (key === 'constructor' || seen.has(key)) { continue; }
      seen.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(owner, key)!;

      if (typeof descriptor.value === 'function') { continue; }
      try {
        const value: unknown = Reflect.get(object, key);

        if (typeof value !== 'function') { result.push({ key, value, writable: !!(descriptor.set || descriptor.writable) }); }
      } catch (error) { result.push({ key, value: undefined, writable: false, error: error instanceof Error ? error.message : String(error) }); }
    }
    owner = inherited ? Object.getPrototypeOf(owner) as object | null : null;
  }

  return result;
}
