import type * as spec from '@galacean/effects-specification';
import { CompositionComponent } from '../components';
import type { Composition } from '../composition';
import { HierarchyBuilder } from '../hierarchy-builder';
import { PluginSystem } from '../plugin-system';
import { VFXItem } from '../vfx-item';
import type { Precomposition } from './precomposition';

export class PrecompositionManager {
  /**
   * 从预合成数据实例化一棵 VFXItem 树。
   * 由调用方挂载返回的根元素。
   * @param precomposition 预合成数据
   * @param composition 接收预合成资源的合成
   * @returns 实例化生成的根 VFXItem，其子树包含指定合成的所有元素
   */
  static instantiate (precomposition: Precomposition, composition: Composition): VFXItem {
    const scene = precomposition.scene;
    const jsonScene = precomposition.scene.jsonScene;
    const options = precomposition.options;
    const engine = composition.engine;

    engine.effectsObjectServer.clearObjectInstances();
    engine.assetServer.clearSceneData();

    // 通过 PluginSystem.notifyAssetsLoadFinish 通知所有插件的 onAssetsLoadFinish 回调
    PluginSystem.notifyAssetsLoadFinish(scene, options, engine);

    engine.assetServer.prepareAssets(scene, scene.assets);
    engine.assetServer.updateTextVariables(scene, options.variables);

    composition.createTexturesFromData(scene.textureOptions);

    for (const key of Object.keys(scene.assets)) {
      const videoAsset = scene.assets[key];

      if (videoAsset instanceof HTMLVideoElement) {
        composition.videos.push(videoAsset);
      }
    }

    const targetCompositionId = jsonScene.compositionId;

    // 1. 找到目标合成数据
    //-------------------------------------------------------------------------

    const compositionData = jsonScene.compositions.find(c => c.id === targetCompositionId);

    if (!compositionData) {
      throw new Error(`Composition with id "${targetCompositionId}" not found in JSONScene.`);
    }

    // 2. 创建根 VFXItem
    //-------------------------------------------------------------------------

    const rootItem = new VFXItem(engine);

    // 3. 实例化预合成
    //-------------------------------------------------------------------------

    PrecompositionManager.instantiateHierarchy(compositionData, rootItem);

    rootItem.getComponent(CompositionComponent).playOnStart = options.autoplay ?? true;
    rootItem.getComponent(CompositionComponent).endBehavior = rootItem.endBehavior;

    return rootItem;
  }

  /** @internal Instantiate a composition into a caller-provided root. */
  static instantiateHierarchy (
    definition: spec.CompositionData,
    root: VFXItem,
  ): void {
    const builder = new HierarchyBuilder(root.engine);

    root.name = definition.name;
    root.duration = definition.duration;
    root.endBehavior = definition.endBehavior;
    builder.spawnComposition(definition, root);
    builder.deserialize();
  }
}
