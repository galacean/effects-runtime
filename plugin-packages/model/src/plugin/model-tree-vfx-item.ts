import type { spec, Transform, Composition } from '@galacean/effects';
import { VFX_ITEM_TYPE_TREE, VFXItem, TimelineComponent } from '@galacean/effects';
import { ModelTreeItem } from './model-tree-item';
import type { ModelItemTree, ModelTreeOptions } from '../index';

export class ModelTreeVFXItem extends VFXItem<ModelTreeItem> {
  options: ModelTreeOptions;
  timeline?: TimelineComponent;

  override get type (): spec.ItemType {
    return VFX_ITEM_TYPE_TREE;
  }

  override onConstructed (props: ModelItemTree) {
    this.options = props.content.options.tree;
    this.timeline = new TimelineComponent(props.content, this);
    this.timeline.getRenderData(0, true);
  }

  override onLifetimeBegin () {
    this.content.baseTransform.setValid(true);
  }

  protected override onItemRemoved (composition: Composition, content?: ModelTreeItem | undefined): void {
    if (this.content !== undefined) {
      this.content.dispose();
    }
  }

  override onItemUpdate (dt: number, lifetime: number) {
    const time = (this.timeInms - this.delayInms) * 0.001;

    this.timeline?.getRenderData(time, true);
    // TODO: 需要使用lifetime
    this.content.tick(dt);
  }

  protected override doCreateContent (): ModelTreeItem {
    return new ModelTreeItem(this.options, this);
  }

  override getNodeTransform (itemId: string): Transform {
    if (this.content === undefined) {
      return this.transform;
    }

    const idWithSubfix = this.id + '^';

    if (itemId.indexOf(idWithSubfix) === 0) {
      const nodeId = itemId.substring(idWithSubfix.length);

      return this.content.getNodeTransform(nodeId);
    } else {
      return this.transform;
    }
  }
}
