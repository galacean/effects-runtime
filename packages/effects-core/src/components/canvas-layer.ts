import { removeItem } from '../utils';
import type { CanvasItem } from './canvas-item';
import { Component } from './component';

/**
 * 画布层组件
 *
 * 作为一组顶层 CanvasItem 的容器:本层内所有 parent 为 null 的 CanvasItem 都登记在 canvasItems 中。
 * 嵌套关系下的子 CanvasItem 通过其父 CanvasItem 的 children 数组管理,由父节点在 draw 时递归绘制。
 */
export class CanvasLayer extends Component {
  /**
   * 当前层中的顶层 CanvasItem 列表(按注册顺序)。
   * 仅包含 parent 为 null 的 CanvasItem;嵌套的子 CanvasItem 不会出现在此列表
   */
  readonly canvasItems: CanvasItem[] = [];
  /**
   * 绘制层级,数值越小越先绘制
   */
  layer = 0;

  /**
   * 注册一个顶层 CanvasItem 到当前层
   * @internal
   */
  addCanvasItem (canvasItem: CanvasItem): void {
    if (this.canvasItems.includes(canvasItem)) {
      return;
    }
    this.canvasItems.push(canvasItem);
  }

  /**
   * 从当前层注销一个顶层 CanvasItem
   * @internal
   */
  removeCanvasItem (canvasItem: CanvasItem): void {
    removeItem(this.canvasItems, canvasItem);
  }

  override onEnable (): void {
    const canvasLayers = this.item.composition?.canvasLayers;

    if (canvasLayers && !canvasLayers.includes(this)) {
      canvasLayers.push(this);
    }
  }

  override onDisable (): void {
    this.removeFromComposition();
    this.refreshCanvasItemsLayer();
  }

  private removeFromComposition (): void {
    const canvasLayers = this.item.composition?.canvasLayers;

    if (canvasLayers) {
      removeItem(canvasLayers, this);
    }
  }

  private refreshCanvasItemsLayer (): void {
    // CanvasLayer 失效时,让其下挂的 CanvasItem 重新查找归属层
    // 拷贝一份避免迭代过程中数组被修改
    const items = this.canvasItems.slice();

    this.canvasItems.length = 0;
    for (const canvasItem of items) {
      canvasItem.updateCanvasLayer();
    }
  }

  /**
   * 绘制当前层
   *
   * 1. 从 engine.canvas 取当前尺寸,直接写到自身 RectTransform.size 并触发 sizeChanged()
   *    传播给所有子 RectTransform(顶层 Control)
   * 2. 遍历顶层 CanvasItem 进行绘制,由 CanvasItem.drawInternal 内部递归子节点
   *
   * @internal
   */
  draw (): void {
    // const canvas = this.item?.engine?.canvas;

    // if (canvas) {
    //   const rect = canvas.getBoundingClientRect();

    //   // RectTransform.setSize 顶层分支:直接 super.setSize 写,然后 sizeChanged 传播给子节点;
    //   // size 没变时早返回,不触发链式
    //   (this.item.transform as RectTransform).setSize(rect.width, rect.height);
    // }

    for (const canvasItem of this.canvasItems) {
      // 整棵跳过看 vfxItem.active(item 级开关);self 自身是否画在 drawInternal 内由 component.enabled 决定
      if (!canvasItem.item.isActive) {
        continue;
      }
      canvasItem.drawInternal();
    }
  }
}
