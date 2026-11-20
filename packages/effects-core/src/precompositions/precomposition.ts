import { CompositionComponent } from '../components/composition-component';
import type { Composition } from '../composition';
import type { Scene, SceneLoadOptions } from '../scene';
import { SceneLoader } from '../scene-loader';
import type { Disposable } from '../utils';
import { assertExist } from '../utils';
import type { VFXItem } from '../vfx-item';

/**
 * 预合成数据类，包含准备好的场景数据和加载选项。
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

  /**
   * 从预合成数据实例化一棵 VFXItem 树，由调用方挂载返回的根元素。
   * @param composition 提供引擎上下文的合成
   * @returns 实例化生成的根 VFXItem，其子树包含指定合成的所有元素
   */
  instantiate (composition: Composition): VFXItem {
    const { scene, options } = this;
    const { compositionId, compositions } = scene.jsonScene;
    const compositionData = compositions.find(data => data.id === compositionId);

    assertExist(compositionData);
    const rootItem = SceneLoader.instantiateComposition(compositionData, composition.engine, scene);
    const compositionComponent = rootItem.getComponent(CompositionComponent);

    compositionComponent.playOnStart = options.autoplay ?? true;
    compositionComponent.endBehavior = rootItem.endBehavior;

    return rootItem;
  }

  /** 在不再使用该预合成及其实例后，释放预加载的视频源。 */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const video of this.scene.videos) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    for (const image of this.scene.images) {
      if (image instanceof HTMLVideoElement) {
        image.pause();
        image.removeAttribute('src');
        image.load();
      }
    }
  }
}
