import type { Scene, Composition, RenderFrame, VFXItem } from '@galacean/effects';
import { AbstractPlugin, spec } from '@galacean/effects';
import { PAnimationSystem } from '../runtime/animation';
import type { ModelTreeItem } from './model-tree-item';

/**
 * 场景树插件类，支持 3D 相关的节点动画和骨骼动画等
 */
export class ModelTreePlugin extends AbstractPlugin {
  /**
   * 插件名称
   */
  override name = 'tree';

  /**
   * 高优先级更新
   */
  override order = 2;

  /**
   * 合成创建，同时创建动画系统
   * @param composition 合成
   * @param scene 场景
   */
  override onCompositionConstructed (composition: Composition, scene: Scene): void {
    const engine = composition.getEngine();
    const animSystem = new PAnimationSystem(engine);

    composition.loaderData.animSystem = animSystem;
  }

  /**
   * 合成将要重置，销毁动画系统
   * @param composition 合成
   * @param renderFrame 渲染帧
   */
  override onCompositionWillReset (composition: Composition, renderFrame: RenderFrame) {
    const animSystem = this.getAnimationSystem(composition);

    if (animSystem !== undefined) {
      animSystem.dispose();
    }
  }

  /**
   * 合成销毁，销毁动画系统
   * @param composition 合成
   */
  override onCompositionDestroyed (composition: Composition) {
    const animSystem = this.getAnimationSystem(composition);

    if (animSystem !== undefined) {
      animSystem.dispose();
    }

    delete composition.loaderData['animSystem'];
  }

  /**
   * 元素生命周期开始，将场景树元素添加到动画系统中
   * @param composition 合成
   * @param item 元素
   */
  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<ModelTreeItem>) {
    if (item.type === spec.ItemType.tree) {
      const animSystem = this.getAnimationSystem(composition);
      const treeItem = item.content;

      animSystem?.insert(treeItem.animationManager);
    }
  }

  /**
   * 元素被删除，如果是场景树元素，还要从动画系统删除
   * @param composition 合成
   * @param item 元素
   */
  override onCompositionItemRemoved (composition: Composition, item: VFXItem<ModelTreeItem>) {
    if (item.type === spec.ItemType.tree) {
      const animSystem = this.getAnimationSystem(composition);
      const treeItem = item.content;

      animSystem?.delete(treeItem.animationManager);
    }
  }

  private getAnimationSystem (composition: Composition): PAnimationSystem | undefined {
    const animSystem = composition.loaderData.animSystem;

    if (animSystem !== undefined) {
      return animSystem as PAnimationSystem;
    }
  }
}

