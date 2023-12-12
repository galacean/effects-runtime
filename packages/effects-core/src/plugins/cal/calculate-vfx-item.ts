import * as spec from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItemProps } from '../../vfx-item';
import { VFXItem } from '../../vfx-item';
import type { Composition } from '../../composition';
import type { SpriteRenderData } from '../sprite/sprite-mesh';
import { CalculateItem } from './calculate-item';

export class CalculateVFXItem extends VFXItem<CalculateItem> {
  relative?: boolean;
  cal: any;
  override _v_priority = 1;
  childrenVisible = true;
  renderData: SpriteRenderData;

  override get type (): spec.ItemType {
    return spec.ItemType.null;
  }

  override onConstructed (props: VFXItemProps) {
    this.cal = props.content;
    this.relative = props.relative;
  }

  override onLifetimeBegin (composition: Composition, content: CalculateItem) {
    content.active = true;
  }

  override onItemRemoved (composition: Composition, content: CalculateItem) {
  }

  override onItemUpdate (dt: number, lifetime: number) {
    if (this.content) {
      this.content.updateTime(this.time);
      this.renderData = this.content.getRenderData(this.content.time);

      /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
      // if (this.parentId) {
      //   const parent = this.composition?.getItemByID(this.parentId);
      //
      //   if ((parent as CalculateVFXItem).renderData) {
      //     const color = parent?.getRenderData().color;
      //
      //     if (color && !this.renderData.color) {
      //       this.renderData.color = [1, 1, 1, 1];
      //     }
      //     vecMulCombine(this.renderData.color as spec.vec4, this.renderData.color, color);
      //
      //   }
      // }
      // this.renderData.visible = this.visible;
      /********************/
    }
  }

  override setScale (x: number, y: number, z: number) {
    this.content.startSize = new Vector3(x, y, z);
  }

  override scale (x: number, y: number, z: number) {
    const startSize = this.content.startSize.clone();

    this.content.startSize = new Vector3(x * startSize.x, y * startSize.y, z * startSize.z);
  }

  override getHitTestParams (force?: boolean): void {
  }

  override getRenderData (): SpriteRenderData {
    return this.renderData;
  }

  // hide its children when visible is fasle
  getChildrenVisible () {
    return this.childrenVisible;
  }
  setChildrenVisible (visible: boolean) {
    if (this.childrenVisible !== visible) {
      this.childrenVisible = !!visible;
      this.handleVisibleChanged(this.visible);
    }
  }

  protected override doCreateContent (composition: Composition) {
    const content: CalculateItem = new CalculateItem(this.cal, this);

    content.renderData = content.getRenderData(0, true);

    return content;
  }

  protected override handleVisibleChanged (visible: boolean) {
    if (this.content) {
      this.content.visible = visible || this.childrenVisible;
    }
  }
}
