import type { Scene, SceneLoadOptions } from '../scene';
import type { Disposable } from '../utils';

/**
 * 预合成数据类，包含预合成 Json 数据和加载选项。
 */
export class Precomposition implements Disposable {
  /**
   * @internal
   */
  scene: Scene;
  /**
   * @internal
   */
  options: SceneLoadOptions;
  private disposed = false;

  constructor (scene: Scene, options: SceneLoadOptions = {}) {
    this.scene = scene;
    this.options = options;
  }

  /** 在不再使用该预合成及其实例后，释放预加载的视频源。 */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const id of Object.keys(this.scene.assets)) {
      const asset = this.scene.assets[id];

      if (asset instanceof HTMLVideoElement) {
        asset.pause();
        asset.removeAttribute('src');
        asset.load();
      }
    }
  }
}
