import { CompositionComponent, type Component } from '../components';
import type { Composition } from '../composition';
import { PluginSystem } from '../plugin-system';
import type { Texture } from '../texture/texture';
import { VFXItem } from '../vfx-item';
import type { Precomposition } from './precomposition';

export class PrecompositionManager {
  /**
   * 从预合成数据实例化一棵 VFXItem 树。
   * 可挂载到现有合成的节点下。
   * @param precomposition 预合成数据
   * @param composition 目标合成
   * @returns 实例化生成的根 VFXItem，其子树包含指定合成的所有元素
   */
  static instantiate (precomposition: Precomposition, composition: Composition): VFXItem {
    const scene = precomposition.scene;
    const jsonScene = precomposition.scene.jsonScene;
    const options = precomposition.options;
    const engine = composition.engine;

    engine.clearResources();

    // 触发插件系统 pluginSystem 的回调 onAssetsLoadFinish
    PluginSystem.onAssetsLoadFinish(scene, options, engine);

    engine.assetService.prepareAssets(scene, scene.assets);
    engine.assetService.updateTextVariables(scene, options.variables);

    for (let i = 0; i < scene.textureOptions.length; i++) {
      const texture = engine.findObject<Texture>({ id: scene.textureOptions[i].id });

      texture.initialize();
      composition.textures.push(texture);
    }

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

    rootItem.setInstanceId(compositionData.id);
    rootItem.name = compositionData.name ?? 'instantiatedItem';
    rootItem.duration = compositionData.duration;
    rootItem.endBehavior = compositionData.endBehavior;

    // 3. 加载合成的组件
    //-------------------------------------------------------------------------

    for (const componentPath of compositionData.components) {
      const component = engine.findObject<Component>(componentPath);

      rootItem.components.push(component);
      component.item = rootItem;
    }

    rootItem.getComponent(CompositionComponent).playOnStart = options.autoplay ?? true;

    // 4. 构建 item 树
    //-------------------------------------------------------------------------

    // @ts-expect-error TODO update spec
    for (const childId of compositionData.children ?? []) {
      const childItem = engine.findObject<VFXItem>(childId);

      childItem.setParent(rootItem);
    }

    rootItem.refreshGUIDRecursive();

    composition.addItem(rootItem);

    return rootItem;
  }
}
