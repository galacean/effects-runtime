import type { Color } from '@galacean/effects-math/es/core';
import type { VFXItem } from '..';
import { removeItem } from '../utils';
import { CanvasLayer } from './canvas-layer';
import { Component } from './component';

/**
 * 画布元素组件
 * 进入场景树时沿父链向上查找最近的 CanvasLayer 祖先并注册自己；
 * 离开场景树、父级改变或自身禁用时，从所在 CanvasLayer 注销。
 */
export class CanvasItem extends Component {
  /**
   * 父 CanvasItem
   * 沿 VFXItem 父链向上查找到的最近的激活 CanvasItem。
   * 若不存在 CanvasItem 祖先（即直属于 CanvasLayer 或处于游离状态），该值为 null。
   */
  parent: CanvasItem | null = null;
  /**
   * 子 CanvasItem 列表（按注册顺序）
   * 由子节点在维护自身 parent 时反向写入，draw 时按数组顺序递归绘制
   */
  readonly children: CanvasItem[] = [];
  /**
   * 当前所属的 CanvasLayer，未注册到任何 CanvasLayer 时为 null
   */
  protected canvasLayerNode: CanvasLayer | null = null;

  /**
   * 获取当前所属的 CanvasLayer
   */
  get canvasLayer (): CanvasLayer | null {
    return this.canvasLayerNode;
  }

  override onEnable (): void {
    // 组件启用时（进入场景树），加入最近的 CanvasLayer 祖先并更新父 CanvasItem
    this.updateCanvasLayer();
    this.updateParentItem();
  }

  override onDisable (): void {
    // 组件禁用时（离开场景树），从当前 CanvasLayer 与父 CanvasItem 注销
    this.removeFromParent();
    this.removeFromCanvasLayer();
    // 自身失效后，子 CanvasItem 需要重新查找新的父 CanvasItem（向上跳过自己）
    this.updateChildrenParentItems();
  }

  override onParentChanged (): void {
    // VFXItem 的父级（或间接父级）发生变化时，CanvasLayer 与父 CanvasItem 都可能改变，需要联动刷新
    this.updateCanvasLayer();
    this.updateParentItem();
  }

  override onDestroy (): void {
    this.removeFromParent();
    this.removeFromCanvasLayer();

    // 防止子 canvasItem updateParentItem 的时候继续找到当前已销毁的 canvasItem
    this.enabled = false;
    this.updateChildrenParentItems();
  }

  /**
   * 重新计算并更新当前 CanvasItem 应归属的 CanvasLayer
   * 在父级变化、所在 CanvasLayer 失效等场景中调用
   *
   * 仅当自身是顶层 CanvasItem（parent 为 null）时才会登记到 CanvasLayer.canvasItems；
   * 嵌套的子 CanvasItem 仅记录 canvasLayerNode 引用，不进入 layer 的顶层列表。
   * @internal
   */
  updateCanvasLayer (): void {
    // 仅当组件激活时才需要归属到 CanvasLayer，否则视为游离状态
    if (!this.item || !this.isActiveAndEnabled) {
      this.removeFromCanvasLayer();

      return;
    }

    const newLayer = this.getCanvasLayerNode();

    if (newLayer === this.canvasLayerNode) {
      return;
    }

    // 仅当自身是顶层 CanvasItem 时，才需要在 layer 的 canvasItems 中迁移
    if (this.parent === null && this.canvasLayerNode) {
      this.canvasLayerNode.removeCanvasItem(this);
    }

    this.canvasLayerNode = newLayer;

    if (this.parent === null && newLayer) {
      newLayer.addCanvasItem(this);
    }
  }

  /**
   * 重新计算并更新当前 CanvasItem 的父 CanvasItem
   * 在 VFXItem 父级变化、自身启用/禁用、父 CanvasItem 失效等场景中调用
   *
   * parent 的变化会同步影响在 CanvasLayer.canvasItems 中的归属：
   *   - 由有 parent 变成无 parent 且仍归属某 layer：加入 layer.canvasItems
   *   - 由无 parent 变成有 parent：从 layer.canvasItems 中移除
   * @internal
   */
  updateParentItem (): void {
    // 游离状态下不维护父子关系
    if (!this.item || !this.isActiveAndEnabled) {
      this.removeFromParent();

      return;
    }

    const newParent = this.getParentItem();

    if (newParent === this.parent) {
      return;
    }

    const wasTopLevel = this.parent === null;

    this.removeFromParent();

    if (newParent) {
      this.parent = newParent;
      newParent.children.push(this);
      // 由顶层变成嵌套：从 layer 的顶层列表中移除
      if (wasTopLevel && this.canvasLayerNode) {
        this.canvasLayerNode.removeCanvasItem(this);
      }
    } else if (!wasTopLevel && this.canvasLayerNode) {
      // 由嵌套变成顶层：加入 layer 的顶层列表
      this.canvasLayerNode.addCanvasItem(this);
    }
  }

  /**
   * 绘制函数
   * 子类重写此方法以输出实际的绘制内容；调用时 graphics 的变换栈顶已经累积了从根到当前节点的所有父变换，
   * 子类直接使用 this.drawXxx / this.fillXxx 系列封装方法绘制即可，绘制坐标视为本地坐标。
   */
  draw () {
    // OVERRIDE
  }

  /**
   * 绘制单条线段
   * @param x1 - 起点 x
   * @param y1 - 起点 y
   * @param x2 - 终点 x
   * @param y2 - 终点 y
   * @param color - 线条颜色
   * @param thickness - 线宽
   */
  drawLine (x1: number, y1: number, x2: number, y2: number, color?: Color, thickness?: number): void {
    this.engine.graphics.drawLine(x1, y1, x2, y2, color, thickness);
  }

  /**
   * 按顺序连接所有点绘制折线（首尾相同则视为闭合）
   * @param points - 点数组，格式 [x1,y1,x2,y2,...]
   * @param color - 线条颜色
   * @param thickness - 线宽
   */
  drawPolyline (points: number[], color?: Color, thickness?: number): void {
    this.engine.graphics.drawLines(points, color, thickness);
  }

  /**
   * 绘制三次贝塞尔曲线
   */
  drawBezier (
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number,
    color?: Color,
    thickness?: number,
  ): void {
    this.engine.graphics.drawBezier(x1, y1, x2, y2, x3, y3, x4, y4, color, thickness);
  }

  /**
   * 绘制三角形边框
   */
  drawTriangle (
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    color?: Color,
    thickness?: number,
  ): void {
    this.engine.graphics.drawTriangle(x1, y1, x2, y2, x3, y3, color, thickness);
  }

  /**
   * 绘制矩形边框
   * @param x - 矩形左下角 x 坐标
   * @param y - 矩形左下角 y 坐标
   */
  drawRect (x: number, y: number, width: number, height: number, color?: Color, thickness?: number): void {
    this.engine.graphics.drawRectangle(x, y, width, height, color, thickness);
  }

  /**
   * 绘制圆形边框
   */
  drawCircle (cx: number, cy: number, radius: number, color?: Color, thickness?: number): void {
    this.engine.graphics.drawCircle(cx, cy, radius, color, thickness);
  }

  /**
   * 绘制填充三角形
   */
  fillTriangle (
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    color?: Color,
  ): void {
    this.engine.graphics.fillTriangle(x1, y1, x2, y2, x3, y3, color);
  }

  /**
   * 绘制填充矩形
   * @param x - 矩形左下角 x 坐标
   * @param y - 矩形左下角 y 坐标
   */
  fillRect (x: number, y: number, width: number, height: number, color?: Color): void {
    this.engine.graphics.fillRectangle(x, y, width, height, color);
  }

  /**
   * 绘制填充圆形
   */
  fillCircle (cx: number, cy: number, radius: number, color?: Color): void {
    this.engine.graphics.fillCircle(cx, cy, radius, color);
  }

  /**
   * 绘制自身并按 children 数组顺序递归绘制所有子 CanvasItem。
   * @internal
   */
  drawInternal () {
    const graphics = this.engine.graphics;
    const localMatrix2D = this.transform.getMatrix2D();

    graphics.pushTransform(localMatrix2D);

    this.draw();

    for (const child of this.children) {
      if (!child.isActiveAndEnabled) {
        continue;
      }
      child.drawInternal();
    }

    graphics.popTransform();
  }

  /**
   * 从当前所属的 CanvasLayer 注销自身（如果有）
   * 仅当自身是顶层 CanvasItem 时，才会触发 layer 顶层列表的移除
   */
  private removeFromCanvasLayer (): void {
    if (!this.canvasLayerNode) {
      return;
    }
    if (this.parent === null) {
      this.canvasLayerNode.removeCanvasItem(this);
    }
    this.canvasLayerNode = null;
  }

  /**
   * 从当前父 CanvasItem 的 children 中移除自身（如果有）
   */
  private removeFromParent (): void {
    if (!this.parent) {
      return;
    }
    removeItem(this.parent.children, this);
    this.parent = null;
  }

  /**
   * 更新所有子 CanvasItem 的层级归属。
   * 自身失效时调用，子节点会跳过自己向上找到新的父 CanvasItem（可能为 null）。
   */
  private updateChildrenParentItems (): void {
    if (this.children.length === 0) {
      return;
    }
    // 拷贝避免迭代过程中数组被 removeFromParent 修改
    const snapshot = this.children.slice();

    for (const child of snapshot) {
      child.updateParentItem();
    }
  }

  /**
   * 沿父链向上查找最近的 CanvasLayer 祖先
   * 注意：自身所在 VFXItem 上的 CanvasLayer 也参与查找（同节点上可能并存 CanvasLayer 与 CanvasItem）
   */
  private getCanvasLayerNode (): CanvasLayer | null {
    let current: VFXItem | null = this.item;

    while (current) {
      const layer = getCanvasLayerFromItem(current);

      if (layer) {
        return layer;
      }
      current = current.parent ?? null;
    }

    return null;
  }

  /**
   * 沿 VFXItem 父链向上查找最近的激活 CanvasItem 祖先（不包含自身）
   */
  private getParentItem (): CanvasItem | null {
    let current: VFXItem | null = this.item?.parent ?? null;

    while (current) {
      const canvasItem = getCanvasItemFromItem(current);

      if (canvasItem) {
        return canvasItem;
      }
      current = current.parent ?? null;
    }

    return null;
  }
}

/**
 * 在指定 VFXItem 上查找一个激活的 CanvasLayer 组件
 */
function getCanvasLayerFromItem (item: VFXItem): CanvasLayer | null {
  for (const component of item.components) {
    if (component instanceof CanvasLayer && component.isActiveAndEnabled) {
      return component;
    }
  }

  return null;
}

/**
 * 在指定 VFXItem 上查找一个激活的 CanvasItem 组件
 */
function getCanvasItemFromItem (item: VFXItem): CanvasItem | null {
  for (const component of item.components) {
    if (component instanceof CanvasItem && component.isActiveAndEnabled) {
      return component;
    }
  }

  return null;
}

