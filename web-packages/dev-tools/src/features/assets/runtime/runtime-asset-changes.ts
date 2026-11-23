import type { EffectsObject, EffectsObjectServer, Engine } from '@galacean/effects';

type ObjectChangeListener = (id: string, object: EffectsObject | undefined) => void;
type Observation = { listeners: Set<ObjectChangeListener>, disconnect: () => void };

const observations = new WeakMap<EffectsObjectServer, Observation>();

// Observe only this editor server instance and restore its methods when the last observer disconnects.
function observeOperation (registry: EffectsObjectServer, method: 'registerObject' | 'unregisterObject', notify: ObjectChangeListener): () => void {
  const original = registry[method];
  const descriptor = Object.getOwnPropertyDescriptor(registry, method);
  const observe = function (this: EffectsObjectServer, object: EffectsObject): void {
    original.call(this, object);
    const id = object.getInstanceId();

    notify(id, this.objectsCache[id]);
  };

  registry[method] = observe;

  return () => {
    if (registry[method] !== observe) { return; }
    if (descriptor) { Object.defineProperty(registry, method, descriptor); } else { Reflect.deleteProperty(registry, method); }
  };
}

export function observeRuntimeAssets (engine: Engine, listener: ObjectChangeListener): () => void {
  const registry = engine.effectsObjectServer;
  let observation = observations.get(registry);

  if (!observation) {
    const listeners = new Set<ObjectChangeListener>();
    const notify: ObjectChangeListener = (id, object) => { for (const listener of listeners) { listener(id, object); } };
    const stopRegister = observeOperation(registry, 'registerObject', notify);
    const stopUnregister = observeOperation(registry, 'unregisterObject', notify);

    observation = { listeners, disconnect: () => { stopUnregister(); stopRegister(); } };
    observations.set(registry, observation);
  }
  const { listeners, disconnect } = observation;

  listeners.add(listener);

  return () => {
    if (!listeners.delete(listener) || listeners.size) { return; }
    disconnect(); observations.delete(registry);
  };
}

/** Editor asset caches can update a name without calling Asset.setData. */
export function notifyRuntimeAssetChanged (object: EffectsObject): void {
  const registry = object.engine.effectsObjectServer;
  const observation = observations.get(registry);

  if (!observation) { return; }
  const id = object.getInstanceId();

  if (registry.objectsCache[id] === object) {
    for (const listener of observation.listeners) { listener(id, object); }
  }
}
