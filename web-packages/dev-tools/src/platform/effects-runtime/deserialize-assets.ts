import type { Asset, Engine } from '@galacean/effects';
import { VFXItem } from '@galacean/effects';

/** Give standalone asset loading a detached root for the duration of deserialization. */
export function deserializeAssets<T> (engine: Engine, idsMapping: Map<string, string>, deserialize: () => T): T {
  const root = new VFXItem(engine);
  const context = { root, idsMapping, sceneAssets: new Set<Asset>() };

  try {
    return engine.assetServer.withSceneData(undefined, () =>
      engine.effectsObjectServer.withDeserializationContext(context, deserialize));
  } finally {
    root.dispose();
  }
}
