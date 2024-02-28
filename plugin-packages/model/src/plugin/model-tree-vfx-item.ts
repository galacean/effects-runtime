import type { Transform, Composition } from '@galacean/effects';
import { spec, VFXItem, TimelineComponent } from '@galacean/effects';
import { ModelTreeItem } from './model-tree-item';
import type { ModelItemTree, ModelTreeOptions } from '../index';

/**
 * 场景树 VFX 元素
 */
export class ModelTreeVFXItem extends VFXItem<ModelTreeItem> {
  /**
   * 场景树数据
   */
  options: ModelTreeOptions;
  /**
   * 时间轴组件
   */
  timeline?: TimelineComponent;

  /**
   * 获取元素类型
   */
  override get type (): spec.ItemType {
    return spec.ItemType.tree;
  }

  /**
   * 创建元素，同时创建时间轴组件
   * @param props 场景树数据
   */
  override onConstructed (props: ModelItemTree) {
    this.options = props.content.options.tree;
    this.timeline = new TimelineComponent(props.content, this);
    this.timeline.getRenderData(0, true);
  }

  /**
   * 元素开始，需要设置变换标志位
   */
  override onLifetimeBegin () {
    this.content.baseTransform.setValid(true);
  }

  protected override onItemRemoved (composition: Composition, content?: ModelTreeItem | undefined): void {
    if (this.content !== undefined) {
      this.content.dispose();
    }
  }

  /**
   * 元素更新，更新时间轴和动画
   * @param dt 时间间隔
   * @param lifetime 生命时间
   */
  override onItemUpdate (dt: number, lifetime: number) {
    const time = (this.timeInms - this.delayInms) * 0.001;

    this.timeline?.getRenderData(time, true);
    // TODO: 需要使用lifetime
    this.content.tick(dt);
  }

  protected override doCreateContent (): ModelTreeItem {
    return new ModelTreeItem(this.options, this);
  }

  /**
   * 获取元素的变换
   * @param itemId 元素索引
   * @returns
   */
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
