import type { Scene, SceneLoadOptions } from '../scene';

/**
 * 预合成数据类，包含预合成 Json 数据和加载选项。
 */
export class Precomposition {
  /**
   * @internal
   */
  scene: Scene;
  /**
   * @internal
   */
  options: SceneLoadOptions;

  constructor (scene: Scene, options: SceneLoadOptions = {}) {
    this.scene = scene;
    this.options = options;
  }
}