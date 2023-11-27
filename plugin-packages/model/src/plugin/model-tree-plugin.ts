import type { Scene, Composition, RenderFrame, VFXItem } from '@galacean/effects';
import { AbstractPlugin, spec } from '@galacean/effects';
import { PAnimationSystem } from '../runtime/animation';
import type { ModelTreeItem } from './model-tree-item';

export class ModelTreePlugin extends AbstractPlugin {
  override name = 'tree';

  override order = 2;  // 高优先级更新

  override onCompositionConstructed (composition: Composition, scene: Scene): void {
    const engine = composition.getEngine();
    const animSystem = new PAnimationSystem(engine);

    composition.loaderData.animSystem = animSystem;
  }

  override onCompositionWillReset (composition: Composition, renderFrame: RenderFrame) {
    const animSystem = this.getAnimationSystem(composition);

    if (animSystem !== undefined) {
      animSystem.dispose();
    }
  }

  override onCompositionDestroyed (composition: Composition) {
    const animSystem = this.getAnimationSystem(composition);

    if (animSystem !== undefined) {
      animSystem.dispose();
    }

    delete composition.loaderData['animSystem'];
  }

  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<ModelTreeItem>) {
    if (item.type === spec.ItemType.tree) {
      const animSystem = this.getAnimationSystem(composition);
      const treeItem = item.content;

      animSystem?.insert(treeItem.animationManager);
    }
  }

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

