import type { Engine, VFXItem } from '@galacean/effects';

/** Optional local rectangle for document nodes that do not render their own content. */
export interface GizmoItemGeometry {
  readonly min: readonly [number, number],
  readonly max: readonly [number, number],
  readonly includeChildren?: boolean,
}

type Provider = (item: VFXItem) => GizmoItemGeometry | undefined;
const providers = new WeakMap<Engine, Provider>();

/** Register geometry for one engine, without changing other editor instances. */
export function registerItemGeometry (engine: Engine, provider: Provider): () => void {
  if (providers.has(engine)) { throw new Error('An editor geometry provider is already registered for this engine.'); }
  providers.set(engine, provider);
  let active = true;

  return () => {
    if (active && providers.get(engine) === provider) {
      providers.delete(engine);
    }
    active = false;
  };
}

export function getHostItemGeometry (item: VFXItem): GizmoItemGeometry | undefined {
  return providers.get(item.engine)?.(item);
}
