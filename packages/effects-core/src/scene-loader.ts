import type { Composition } from './composition';
import type { Engine } from './engine';
import type { Scene, SceneLoadOptions } from './scene';
import { SceneServer } from './scene-server';

/**
 * @hidden
 * Internal utility.
 * Not part of the public API — do not rely on this in your code.
 */
export class SceneLoader {
  static async load (scene: Scene.LoadType, engine: Engine, options: SceneLoadOptions = {}): Promise<Composition> {
    return engine.getServer(SceneServer).loadScene(scene, options);
  }
}
