import type { Color } from '@galacean/effects-math/es/core';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import type { VFXItem } from '../vfx-item';
import type { FontStyle, FontWeight, TextureRegion } from '../render';
import type { Texture } from '../texture';
import { removeItem } from '../utils';
import { Viewport } from '../viewport';
import { CanvasLayer } from './canvas-layer';
import { Component } from './component';

/**
 * 画布元素组件
 *
 * CanvasItem belongs to either the closest Viewport's default Canvas or an
 * explicit CanvasLayer. Only a CanvasItem on the direct parent VFXItem forms
 * a CanvasItem parent relationship.
 *
 * 注:拓扑(parent / children / 所属 layer)与 enabled/active 解耦 —
 * `component.enabled=false` 仅让自身 draw 被跳过,**不**改父子关系,也**不**从 layer 注销;
 * 整棵子树的隐藏由 `vfxItem.setActive(false)` 配合 drawInternal 中的 `isActive` 检查处理
 */
export class CanvasItem extends Component {
  private _topLevel = false;
  private canvasItemDestroyed = false;
  private canvasTopologyVersion = 0;
  /**
   * 父 CanvasItem
   * CanvasItem on the direct parent VFXItem. Ordinary VFXItems break the
   * CanvasItem parent chain.
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

  get topLevel (): boolean {
    return this._topLevel;
  }

  set topLevel (value: boolean) {
    if (this._topLevel === value) {
      return;
    }
    this._topLevel = value;
    this.canvasTopologyVersion++;
    if (this.item) {
      this.transform.parentTransform = value ? null : this.item.parent?.transform ?? null;
      this.updateCanvasTopology();
    }
  }

  /**
   * 获取当前所属的 CanvasLayer
   */
  get canvasLayer (): CanvasLayer | null {
    return this.canvasLayerNode;
  }

  /**
   * Closest Viewport resolved from the VFXItem ancestry.
   */
  get viewport (): Viewport {
    return this.item?.getViewport() ?? this.engine.viewport;
  }

  override onEnterTree (): void {
    this.updateCanvasTopology();

    // A CanvasItem added after its VFX children becomes their direct Canvas
    // parent immediately; topology does not depend on playback state.
    for (const childItem of this.item.children) {
      for (const component of childItem.components) {
        if (component instanceof CanvasItem) {
          component.updateCanvasLayer();
        }
      }
    }
  }

  override onExitTree (): void {
    this.detachCanvasTopology();
  }

  override onEnable (): void {
    // 首次接入 / 重新接入场景树时把自己挂上(若拓扑还没建立)。
    // 注意 enable/disable 不再改变 CanvasItem 父子拓扑 — 拓扑由 VFXItem 父链(setParent / onParentChanged)维护,
    // enable 在这里只是兜底首次入树
    this.updateCanvasTopology();
  }

  override onDisable (): void {
    // 组件禁用 = 仅 self.draw 跳过,不应改父子拓扑(否则 enable 回来位置就乱了)。
    // 整棵子树的隐藏由 `vfxItem.setActive(false)` 配合 drawInternal 中的 `item.isActive` 检查处理
    this.onCanvasTopologyChanged();
  }

  override onParentChanged (): void {
    this.canvasTopologyVersion++;
    this.updateCanvasTopology();
  }

  override onDestroy (): void {
    this.destroyCanvasItem();
  }

  override dispose (): void {
    super.dispose();
    // Canvas topology is bound before playback starts, while Component only
    // calls onDestroy() for awakened components. Always detach the topology.
    this.destroyCanvasItem();
  }

  private destroyCanvasItem (): void {
    if (this.canvasItemDestroyed) {
      return;
    }
    this.canvasItemDestroyed = true;
    this.canvasTopologyVersion++;
    this.detachCanvasTopology();

    // 防止子 canvasItem updateParentItem 的时候继续找到当前已销毁的 canvasItem
    this.enabled = false;
    this.updateChildrenParentItems();
  }

  /**
   * Re-resolves the CanvasItem topology after a CanvasLayer state change.
   * @internal
   */
  updateCanvasLayer (): void {
    this.updateCanvasTopology();
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
    this.updateCanvasTopology();
  }

  /**
   * 绘制函数
   * 子类重写此方法以输出实际的绘制内容；调用时 graphics 的变换栈顶已经累积了从根到当前节点的所有父变换，
   * 子类直接使用 this.drawXxx / this.fillXxx 系列封装方法绘制即可，绘制坐标视为本地坐标。
   */
  draw () {
    // OVERRIDE
  }

  /** @internal */
  getGlobalTransform2D (): Matrix3 {
    const local = this.transform.getMatrix2D();

    if (!this.parent || this.topLevel) {
      return local.clone();
    }

    return new Matrix3().multiplyMatrices(this.parent.getGlobalTransform2D(), local);
  }

  /** @internal */
  isActiveInCanvasTree (): boolean {
    if (this.canvasItemDestroyed || !this.isInsideCanvas()) {
      return false;
    }
    if (this.canvasLayerNode && !this.canvasLayerNode.enabled) {
      return false;
    }
    let current: VFXItem | null = this.item;

    while (current) {
      if (!current.isActive) {
        return false;
      }
      current = current.parent ?? null;
    }

    return true;
  }

  /** @internal */
  isCanvasItemDestroyed (): boolean {
    return this.canvasItemDestroyed;
  }

  /** @internal */
  isInsideCanvas (): boolean {
    if (this.parent) {
      return this.parent.children.includes(this);
    }
    if (!this.item) {
      return false;
    }
    if (this.canvasLayerNode) {
      return this.canvasLayerNode.canvasItems.includes(this);
    }
    const viewport = this.viewport;

    return viewport.defaultCanvas.canvasItems.includes(this) ||
      viewport.canvasLayers.some(layer => layer.canvasItems.includes(this));
  }

  /** @internal */
  getCanvasTopologyVersion (): number {
    return this.canvasTopologyVersion;
  }

  /**
   * 层级、激活或绘制归属发生变化时调用。
   */
  protected onCanvasTopologyChanged (): void {
    // OVERRIDE
  }

  /**
   * Called before this CanvasItem is removed from its previous Viewport.
   * @internal
   */
  protected onCanvasTopologyChanging (previousViewport: Viewport | null, nextViewport: Viewport | null): void {
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
   * 绘制纹理矩形(本地坐标,Y 向上,(x, y) 为左下角)
   * @param region - 纹理 UV 子矩形,默认全图。Y 向上,(u0, v0) 为左下角 UV
   * @param color - 乘色,默认白色
   */
  drawTexture (
    x: number, y: number, width: number, height: number,
    texture: Texture,
    region?: TextureRegion,
    color?: Color,
  ): void {
    this.engine.graphics.drawTexture(x, y, width, height, texture, region, color);
  }

  /**
   * 绘制文本(本地坐标,Y 向上,(x, y) 为文本左下角)。
   *
   * 同一段文本不同颜色不会重复 upload — 颜色由 `color` 参数透传作为乘色,纹理只缓存白色字形。
   * 字体参数全部展开,避免调用方每帧创建临时 style 对象触发 GC
   */
  drawText (
    x: number, y: number,
    text: string,
    fontSize: number,
    color?: Color,
    fontFamily?: string,
    fontWeight?: FontWeight,
    fontStyle?: FontStyle,
  ): void {
    this.engine.graphics.drawText(x, y, text, fontSize, color, fontFamily, fontWeight, fontStyle);
  }

  /**
   * 绘制自身并按 children 数组顺序递归绘制所有子 CanvasItem。
   * @internal
   */
  drawInternal () {
    const graphics = this.engine.graphics;
    const localMatrix2D = this.transform.getMatrix2D();

    graphics.pushTransform(localMatrix2D);

    // self 是否绘制只看 component.enabled — 其它都不影响。
    // transform 始终被 push,children 始终被遍历,这样 component.enabled=false 时 self 隐藏
    // 但 children 的位置不受影响
    if (this.enabled) {
      this.draw();
    }

    // 子是否参与绘制看 VFXItem.isActive(整棵跳过的语义)。
    // 子自身的 component.enabled 在它自己的 drawInternal 里再判断
    for (const child of this.children) {
      if (!child.item.isActive) {
        continue;
      }
      child.drawInternal();
    }

    graphics.popTransform();
  }

  private updateCanvasTopology (): void {
    if (!this.item || !this.item.isInsideTree || this.canvasItemDestroyed) {
      this.detachCanvasTopology();

      return;
    }

    const nextViewport = this.item.getViewport();
    const ownLayer = getCanvasLayerFromItem(this.item);
    const ownViewport = this.item.getComponent(Viewport);
    const ownsViewportBoundary = ownViewport?.isActiveInTree === true;
    let nextParent: CanvasItem | null = null;
    let nextLayer: CanvasLayer | null = ownLayer;

    if (!this.topLevel && !ownLayer && !ownsViewportBoundary) {
      const directParent = this.item.parent ? getCanvasItemFromItem(this.item.parent) : null;

      if (directParent) {
        if (!directParent.isInsideCanvas()) {
          directParent.updateCanvasTopology();
        }
        if (directParent.isInsideCanvas() && directParent.viewport === nextViewport) {
          nextParent = directParent;
          nextLayer = directParent.canvasLayerNode;
        }
      }
    }

    if (!nextParent) {
      nextLayer = nextLayer ?? this.getCanvasLayerNode();
    }
    const nextCanvas = nextLayer?.canvas ?? nextViewport.defaultCanvas;
    const wasInsideCanvas = this.isInsideCanvas();

    if (wasInsideCanvas && nextParent === this.parent && nextLayer === this.canvasLayerNode) {
      return;
    }

    const previousViewport = wasInsideCanvas ? this.viewport : null;

    this.onCanvasTopologyChanging(previousViewport, nextViewport);
    this.removeFromCanvas(previousViewport);
    this.removeFromParent();

    this.canvasLayerNode = nextLayer;
    this.parent = nextParent;

    if (nextParent) {
      if (!nextParent.children.includes(this)) {
        nextParent.children.push(this);
      }
    } else {
      nextCanvas.addCanvasItem(this);
    }

    this.canvasTopologyVersion++;
    this.onCanvasTopologyChanged();
    this.updateChildrenParentItems();
  }

  private detachCanvasTopology (): void {
    if (!this.isInsideCanvas()) {
      return;
    }

    const previousViewport = this.viewport;

    this.onCanvasTopologyChanging(previousViewport, null);
    this.removeFromCanvas(previousViewport);
    this.removeFromParent();
    this.canvasLayerNode = null;
    this.canvasTopologyVersion++;
    this.onCanvasTopologyChanged();
  }

  private removeFromCanvas (viewport: Viewport | null): void {
    if (this.parent === null && viewport) {
      const canvas = this.canvasLayerNode?.canvas ?? viewport.defaultCanvas;

      canvas.removeCanvasItem(this);
    }
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
   * Finds the closest active CanvasLayer without crossing a Viewport boundary.
   */
  private getCanvasLayerNode (): CanvasLayer | null {
    let current: VFXItem | null = this.item;

    while (current) {
      const layer = getCanvasLayerFromItem(current);

      if (layer) {
        return layer;
      }
      const viewport = current.getComponent(Viewport);

      if (viewport?.isActiveInTree) {
        return null;
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
    if (component instanceof CanvasLayer && component.isActiveInCanvasTree()) {
      return component;
    }
  }

  return null;
}

/**
 * 在指定 VFXItem 上查找 CanvasItem 组件(只看类型,不看 active/enabled — 拓扑跟激活状态解耦)
 */
function getCanvasItemFromItem (item: VFXItem): CanvasItem | null {
  for (const component of item.components) {
    if (component instanceof CanvasItem && !component.isCanvasItemDestroyed()) {
      return component;
    }
  }

  return null;
}
