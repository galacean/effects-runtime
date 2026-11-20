import { CompositionComponent } from '../components';
import type { Composition } from '../composition';
import { SceneObjectsFactory } from '../scene-objects-factory';
import { assertExist } from '../utils';
import { VFXItem } from '../vfx-item';
import type { Precomposition } from './precomposition';

export class PrecompositionManager {
  /**
   * 从预合成数据实例化一棵 VFXItem 树。
   * 由调用方挂载返回的根元素。
   * @param precomposition 预合成数据
   * @param composition 提供加载环境的合成
   * @returns 实例化生成的根 VFXItem，其子树包含指定合成的所有元素
   */
  static instantiate (precomposition: Precomposition, composition: Composition): VFXItem {
    const { scene, options } = precomposition;
    const { engine } = composition;
    const { compositionId, compositions } = scene.jsonScene;
    const compositionData = compositions.find(data => data.id === compositionId);

    assertExist(compositionData);
    const rootItem = new VFXItem(engine);

    SceneObjectsFactory.instantiateComposition(compositionData, rootItem, scene);
    rootItem.getComponent(CompositionComponent).playOnStart = options.autoplay ?? true;
    rootItem.getComponent(CompositionComponent).endBehavior = rootItem.endBehavior;

    return rootItem;
  }
}
