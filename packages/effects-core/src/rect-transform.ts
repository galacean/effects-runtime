import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type * as spec from '@galacean/effects-specification';
import { Transform } from './transform';

/**
 * 2D 矩形,`position` 为左下角(Y 向上),`size` 为宽高
 */
export type Rect = {
  position: Vector2,
  size: Vector2,
};

/**
 * 16 个内建锚点预设,字面意义对应屏幕视觉位置(Y 向上)
 */
export type LayoutPreset =
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  | 'centerLeft' | 'centerTop' | 'centerRight' | 'centerBottom'
  | 'center'
  | 'leftWide' | 'topWide' | 'rightWide' | 'bottomWide'
  | 'vcenterWide' | 'hcenterWide'
  | 'fullRect';

/**
 * 16 个 preset 对应的 anchorMin / anchorMax(Y 向上)
 */
const ANCHOR_PRESET_TABLE: Record<LayoutPreset, [number, number, number, number]> = {
  // [anchorMin.x, anchorMin.y, anchorMax.x, anchorMax.y]
  topLeft:      [0, 1, 0, 1],
  topRight:     [1, 1, 1, 1],
  bottomLeft:   [0, 0, 0, 0],
  bottomRight:  [1, 0, 1, 0],
  centerLeft:   [0, 0.5, 0, 0.5],
  centerTop:    [0.5, 1, 0.5, 1],
  centerRight:  [1, 0.5, 1, 0.5],
  centerBottom: [0.5, 0, 0.5, 0],
  center:       [0.5, 0.5, 0.5, 0.5],
  leftWide:     [0, 0, 0, 1],
  topWide:      [0, 1, 1, 1],
  rightWide:    [1, 0, 1, 1],
  bottomWide:   [0, 0, 1, 0],
  vcenterWide:  [0.5, 0, 0.5, 1],
  hcenterWide:  [0, 0.5, 1, 0.5],
  fullRect:     [0, 0, 1, 1],
};

/**
 * 锚点布局变换。`RectTransform extends Transform`,在 Transform 的 position/rotation/scale/size/anchor(=pivot 偏移)
 * 之上额外维护 4 边锚点 + 4 边像素偏移,提供 rect 解算与编辑 API。
 *
 * 解算公式(Y 向上,父 vertex 坐标原点 = 父 rect 左下角):
 * ```
 * left   = offsetMin.x + anchorMin.x * parentSize.x
 * bottom = offsetMin.y + anchorMin.y * parentSize.y
 * right  = offsetMax.x + anchorMax.x * parentSize.x
 * top    = offsetMax.y + anchorMax.y * parentSize.y
 * ```
 *
 * 写回 Transform:
 * - `position` ← `(left, bottom)`(rect 左下角,父 vertex 坐标)
 * - `size`     ← rect 尺寸
 * - `anchor`(Vector3 像素 pivot 偏移)由用户独立设置,仅作旋转/缩放中心
 *
 * **解算入口** 是 `sizeChanged()` 方法:
 * - 父是 RectTransform → 用 `parent.size` 作 parentSize 解算自身,写回 `position` / `size`
 * - 否则(顶层 / 没父):自身 size 视为权威值(由外部 — 通常是 CanvasLayer — 直接写),不再自解算
 * - 末尾遍历 `children` 中的 RectTransform,直接调它们的 `sizeChanged()`,链式向下传播
 *
 * **重写 `setPosition` / `setSize`** 让其语义变为"用户输入 rect 位置 / 尺寸":
 * - 顶层(无 RectTransform 父):直接写 `super.setPosition / super.setSize`,然后 `sizeChanged` 传播给子节点
 * - 否则:反推 offset 维持当前 anchor,然后 `sizeChanged` 重算并向下传
 */
export class RectTransform extends Transform {
  /**
   * 父 rect 上的归一化最小角 `(anchorLeft, anchorBottom)`
   */
  readonly anchorMin = new Vector2(0, 0);
  /**
   * 父 rect 上的归一化最大角 `(anchorRight, anchorTop)`
   */
  readonly anchorMax = new Vector2(0, 0);
  /**
   * rect 左/下边相对 anchorMin 锚点的像素偏移 `(offsetLeft, offsetBottom)`
   */
  readonly offsetMin = new Vector2(0, 0);
  /**
   * rect 右/上边相对 anchorMax 锚点的像素偏移 `(offsetRight, offsetTop)`
   */
  readonly offsetMax = new Vector2(0, 0);
  /**
   * 自身 rect 上的归一化轴心 `(0..1)`,默认 `(0.5, 0.5)`(中心)。两层效果:
   * 1. **Layout**:`setSize` 时 rect 围绕此点对称缩放(pivot=(0.5, 0.5) → 居中扩展;pivot=(0, 0) → 从左下扩展;pivot=(1, 1) → 向左下缩)
   * 2. **矩阵**:`pivot` 自动同步到 `transform.anchor = pivot * size`(像素值,矩阵旋转/缩放中心),
   *    所以旋转/缩放也围绕同一点。`setPivot` 和每次 `sizeChanged`(size 重算后)都会刷新 `transform.anchor`
   */
  readonly pivot = new Vector2(0.5, 0.5);

  /**
   * 用既有 Transform 的状态创建 RectTransform。
   * 用于 Control / CanvasLayer 接管 VFXItem 时,把 VFXItem 自带的 Transform 升级为 RectTransform 而不丢失 position/rotation/scale 等已设置好的状态。
   */
  static fromTransform (t: Transform): RectTransform {
    if (t instanceof RectTransform) {
      return t;
    }

    const rt = new RectTransform();

    rt.engine = t.engine;
    rt.name = t.name;
    rt.position.copyFrom(t.position);
    rt.quat.copyFrom(t.quat);
    rt.rotation.copyFrom(t.rotation);
    rt.scale.copyFrom(t.scale);
    rt.size.copyFrom(t.size);
    // 不拷贝源 anchor — 升级为 RectTransform 时使用默认 pivot=(0.5, 0.5),
    // 把 anchor 同步成 pivot * size,获得"中心轴心"默认行为
    rt.anchor.set(rt.pivot.x * rt.size.x, rt.pivot.y * rt.size.y, t.anchor.z);

    if (t.parentTransform) {
      rt.parentTransform = t.parentTransform;
    }

    return rt;
  }

  /**
   * 反序列化:在 `Transform.fromData` 基础上还原 RectTransform 特有的 `pivot` /
   * `anchorMin` / `anchorMax` / `offsetMin` / `offsetMax`。
   *
   * 顺序:
   * 1. `super.fromData` 还原 `position` / `rotation` / `scale` / `size` / `anchor`
   * 2. 若数据有 size,从 `anchor / size` 反推 `pivot`,保持 `anchor = pivot * size` 一致
   * 3. 应用 `anchorMin/Max` / `offsetMin/Max`,每个 setter 末尾会触发 `sizeChanged`
   *    重新解算 rect 与同步 `transform.anchor`
   */
  override fromData (data: spec.TransformData): void {
    super.fromData(data);

    if (this.size.x !== 0 && this.size.y !== 0) {
      this.pivot.set(this.anchor.x / this.size.x, this.anchor.y / this.size.y);
    }

    // @ts-expect-error spec.TransformData 暂未声明 RectTransform 字段
    if (data.anchorMin) {
      // @ts-expect-error
      this.setAnchorMin(data.anchorMin.x, data.anchorMin.y);
    }
    // @ts-expect-error
    if (data.anchorMax) {
      // @ts-expect-error
      this.setAnchorMax(data.anchorMax.x, data.anchorMax.y);
    }
    // @ts-expect-error
    if (data.offsetMin) {
      // @ts-expect-error
      this.setOffsetMin(data.offsetMin.x, data.offsetMin.y);
    }
    // @ts-expect-error
    if (data.offsetMax) {
      // @ts-expect-error
      this.setOffsetMax(data.offsetMax.x, data.offsetMax.y);
    }
  }

  // ── layout-input setters(改完 → sizeChanged 重算)──────

  setAnchorMin (x: number, y: number): void {
    if (this.anchorMin.x !== x || this.anchorMin.y !== y) {
      this.anchorMin.x = x;
      this.anchorMin.y = y;
      this.sizeChanged();
    }
  }

  setAnchorMax (x: number, y: number): void {
    if (this.anchorMax.x !== x || this.anchorMax.y !== y) {
      this.anchorMax.x = x;
      this.anchorMax.y = y;
      this.sizeChanged();
    }
  }

  setOffsetMin (x: number, y: number): void {
    if (this.offsetMin.x !== x || this.offsetMin.y !== y) {
      this.offsetMin.x = x;
      this.offsetMin.y = y;
      this.sizeChanged();
    }
  }

  setOffsetMax (x: number, y: number): void {
    if (this.offsetMax.x !== x || this.offsetMax.y !== y) {
      this.offsetMax.x = x;
      this.offsetMax.y = y;
      this.sizeChanged();
    }
  }

  /**
   * 设置 rect 内的归一化轴心 `(0..1)`,同时把 `transform.anchor`(矩阵旋转/缩放中心)同步到 `pivot * size`。
   * 不重算 rect(pivot 只决定 setSize 行为,不直接影响当前 rect 位置 / 尺寸)
   */
  setPivot (x: number, y: number): void {
    if (this.pivot.x !== x || this.pivot.y !== y) {
      this.pivot.x = x;
      this.pivot.y = y;
      // 同步 transform.anchor(像素 pivot)= pivot * size,让旋转/缩放绕同一点
      this.anchor.set(this.pivot.x * this.size.x, this.pivot.y * this.size.y, this.anchor.z);
    }
  }

  /**
   * 重写父类 `setPosition`:
   * - 顶层(无 RectTransform 父):直接 `super.setPosition` 写位置,触发 `sizeChanged` 传播
   * - 非顶层:语义为"设置 rect 左下角到 (x, y)",反推 offset 维持当前 anchor,然后 `sizeChanged` 重算
   *
   * @param keepOffsets 默认 false。true 时反推 anchor 而非 offset(rect 在屏幕上不动,但 anchor 比例改变)
   */
  override setPosition (x: number, y: number, z: number, keepOffsets = false): void {
    if (!(this.parentTransform instanceof RectTransform)) {
      // 顶层:直接写,然后传播给子节点
      super.setPosition(x, y, z);
      this.sizeChanged();

      return;
    }
    const parentRect: Rect = {
      position: new Vector2(0, 0),
      size: this.parentTransform.size.clone(),
    };
    const newRect: Rect = {
      position: new Vector2(x, y),
      size: this.size.clone(),
    };

    if (keepOffsets) {
      this.computeAnchors(newRect, parentRect);
    } else {
      this.computeOffsets(newRect, parentRect);
    }
    this.sizeChanged();
    if (this.position.z !== z) {
      super.setPosition(this.position.x, this.position.y, z);
    }
  }

  /**
   * 重写父类 `setSize`:
   * - 顶层:直接 `super.setSize`,触发 `sizeChanged` 传播
   * - 非顶层:反推 offset 维持当前 anchor,然后 `sizeChanged` 重算
   *
   * @param keepOffsets 默认 false。true 时反推 anchor 而非 offset
   */
  override setSize (x: number, y: number): void {
    if (this.size.x === x && this.size.y === y) {
      return;
    }
    if (!(this.parentTransform instanceof RectTransform)) {
      super.setSize(x, y);
      this.sizeChanged();

      return;
    }

    // 围绕 pivot 对称缩放:Δsize 在 offsetMin / offsetMax 上按 pivot / (1-pivot) 比例分配。
    // 例如 pivot=(0.5, 0.5) → 两边各 ±Δ/2,rect 居中扩展;pivot=(0, 0) → offsetMin 不动、offsetMax 全吃,rect 从左下扩展
    const dw = x - this.size.x;
    const dh = y - this.size.y;

    this.offsetMin.set(
      this.offsetMin.x - this.pivot.x * dw,
      this.offsetMin.y - this.pivot.y * dh,
    );
    this.offsetMax.set(
      this.offsetMax.x + (1 - this.pivot.x) * dw,
      this.offsetMax.y + (1 - this.pivot.y) * dh,
    );
    this.sizeChanged();
  }

  // ── rect query ───────────────────────────────────────

  /**
   * 当前自身 rect(在父 vertex 坐标下,Y 向上)。`sizeChanged` 之后才有意义
   */
  getRect (): Rect {
    return {
      position: new Vector2(this.position.x, this.position.y),
      size: this.size.clone(),
    };
  }

  // ── parent linkage ───────────────────────────────────

  /**
   * 父 transform 切换时重算自身布局。子节点链路通过 `Transform.children` 直接访问,无需事件订阅
   * @internal
   */
  protected override onParentTransformChanged (
    _oldParent: Transform | null,
    _newParent: Transform | null,
  ): void {
    if (_oldParent instanceof RectTransform) {
      this.engine.off('resize', this.onCanvasResize.bind(this));
    }

    if (!(_newParent instanceof RectTransform)) {
      this.onCanvasResize();
      this.engine.on('resize', this.onCanvasResize.bind(this));
    }

    this.sizeChanged();
  }

  private onCanvasResize () {
    const rect = this.engine.canvas.getBoundingClientRect();

    this.setSize(rect.width, rect.height);
  }

  // ── layout solver──────────────

  /**
   * 解算入口:
   *
   * 1. 父是 RectTransform → 从 `parent.size` 求自身 rect,通过 `super.setPosition / super.setSize` 写回
   *    (避免触发本类 setPosition / setSize 重写)
   * 2. 顶层(无 RectTransform 父):自身 size 视为权威值(由 CanvasLayer 等外部直接写),不自解算
   * 3. 遍历 `children` 中所有 RectTransform 子节点,直接调它们的 `sizeChanged()` 链式传播
   */
  sizeChanged (): void {
    if (this.parentTransform instanceof RectTransform) {
      const parentSize = this.parentTransform.size;
      const left = this.offsetMin.x + this.anchorMin.x * parentSize.x;
      const bottom = this.offsetMin.y + this.anchorMin.y * parentSize.y;
      const right = this.offsetMax.x + this.anchorMax.x * parentSize.x;
      const top = this.offsetMax.y + this.anchorMax.y * parentSize.y;

      super.setPosition(left, bottom, this.position.z);
      super.setSize(right - left, top - bottom);
    }
    // size 更新后同步 transform.anchor(矩阵旋转/缩放中心)= pivot * size,跟 setPivot 保持统一
    this.anchor.set(this.pivot.x * this.size.x, this.pivot.y * this.size.y, this.anchor.z);

    for (const child of this.children) {
      if (child instanceof RectTransform) {
        child.sizeChanged();
      }
    }
  }

  /**
   * 给定目标 rect 反推 offsetMin/Max,保持当前 anchor 不变
   */
  private computeOffsets (rect: Rect, parentRect: Rect): void {
    this.offsetMin.set(
      rect.position.x - parentRect.position.x - this.anchorMin.x * parentRect.size.x,
      rect.position.y - parentRect.position.y - this.anchorMin.y * parentRect.size.y,
    );
    this.offsetMax.set(
      rect.position.x + rect.size.x - parentRect.position.x - this.anchorMax.x * parentRect.size.x,
      rect.position.y + rect.size.y - parentRect.position.y - this.anchorMax.y * parentRect.size.y,
    );
  }

  /**
   * 给定目标 rect 反推 anchorMin/Max,保持当前 offset 不变。父 size 为 0 的方向不修改
   */
  private computeAnchors (rect: Rect, parentRect: Rect): void {
    if (parentRect.size.x !== 0) {
      const aMinX = (rect.position.x - parentRect.position.x - this.offsetMin.x) / parentRect.size.x;
      const aMaxX = (rect.position.x + rect.size.x - parentRect.position.x - this.offsetMax.x) / parentRect.size.x;

      this.anchorMin.x = aMinX;
      this.anchorMax.x = aMaxX;
    }
    if (parentRect.size.y !== 0) {
      const aMinY = (rect.position.y - parentRect.position.y - this.offsetMin.y) / parentRect.size.y;
      const aMaxY = (rect.position.y + rect.size.y - parentRect.position.y - this.offsetMax.y) / parentRect.size.y;

      this.anchorMin.y = aMinY;
      this.anchorMax.y = aMaxY;
    }
  }

  // ── preset API ───────────────────────────────────────

  /**
   * 把 anchorMin/Max 设为内建预设。
   * @param keepOffsets 默认 true:offset 不动,rect 实际位置会跳到新 anchor 计算的位置(要求保留视觉位置请用 setAnchorsAndOffsetsPreset)
   */
  setAnchorsPreset (preset: LayoutPreset, keepOffsets = true): void {
    const [aMinX, aMinY, aMaxX, aMaxY] = ANCHOR_PRESET_TABLE[preset];

    if (keepOffsets) {
      this.anchorMin.set(aMinX, aMinY);
      this.anchorMax.set(aMaxX, aMaxY);
    } else if (this.parentTransform instanceof RectTransform) {
      const parentRect: Rect = {
        position: new Vector2(0, 0),
        size: this.parentTransform.size.clone(),
      };
      const rect = this.getRect();

      this.anchorMin.set(aMinX, aMinY);
      this.anchorMax.set(aMaxX, aMaxY);
      this.computeOffsets(rect, parentRect);
    } else {
      // 顶层无父 rect 可参考,降级为 keepOffsets
      this.anchorMin.set(aMinX, aMinY);
      this.anchorMax.set(aMaxX, aMaxY);
    }
    this.sizeChanged();
  }

  /**
   * 把 offsetMin/Max 设为预设值,使 rect 在父 rect 内落在视觉上对应的位置(留 margin 像素边距)。
   * 当 anchor 已经按相同 preset 设定时,等价于"贴边放置带 margin 的 rect"。
   * 使用当前 size 作为 rect 尺寸。
   */
  setOffsetsPreset (preset: LayoutPreset, margin = 0): void {
    if (!(this.parentTransform instanceof RectTransform)) {
      return;
    }
    const newSizeX = this.size.x;
    const newSizeY = this.size.y;
    const a = this.anchorMin;
    const b = this.anchorMax;
    const pw = this.parentTransform.size.x;
    const ph = this.parentTransform.size.y;

    let offMinX = 0;
    let offMaxX = 0;
    let offMinY = 0;
    let offMaxY = 0;

    // X 方向(left / right)
    switch (preset) {
      case 'topLeft': case 'bottomLeft': case 'centerLeft':
      case 'topWide': case 'bottomWide': case 'leftWide':
      case 'hcenterWide': case 'fullRect':
        offMinX = margin - a.x * pw;
        offMaxX = margin + newSizeX - b.x * pw;

        break;
      case 'centerTop': case 'centerBottom': case 'center':
      case 'vcenterWide':
        offMinX = 0.5 * pw - newSizeX / 2 - a.x * pw;
        offMaxX = 0.5 * pw + newSizeX / 2 - b.x * pw;

        break;
      case 'topRight': case 'bottomRight': case 'centerRight':
      case 'rightWide':
        offMinX = pw - margin - newSizeX - a.x * pw;
        offMaxX = pw - margin - b.x * pw;

        break;
    }

    // Y 方向(bottom / top)— Y 向上
    switch (preset) {
      case 'bottomLeft': case 'bottomRight': case 'centerBottom':
      case 'leftWide': case 'rightWide': case 'bottomWide':
      case 'vcenterWide': case 'fullRect':
        offMinY = margin - a.y * ph;
        offMaxY = margin + newSizeY - b.y * ph;

        break;
      case 'centerLeft': case 'centerRight': case 'center':
      case 'hcenterWide':
        offMinY = 0.5 * ph - newSizeY / 2 - a.y * ph;
        offMaxY = 0.5 * ph + newSizeY / 2 - b.y * ph;

        break;
      case 'topLeft': case 'topRight': case 'centerTop':
      case 'topWide':
        offMinY = ph - margin - newSizeY - a.y * ph;
        offMaxY = ph - margin - b.y * ph;

        break;
    }

    this.offsetMin.set(offMinX, offMinY);
    this.offsetMax.set(offMaxX, offMaxY);
    this.sizeChanged();
  }

  /**
   * 同时设置 anchor 和 offset,达到"按 preset 摆放并贴边带 margin"的效果。
   *
   * 注意第一步用 `keepOffsets=false`(反推 offset 维持 rect 视觉位置),不能用默认 `true`:
   * 后者会让 rect 的 size 在中间步先跳到错值(因为 anchor 改了 offset 没改),
   * 第二步 `setOffsetsPreset` 又用这个错 size 算 offset,最终 rect size 不对
   */
  setAnchorsAndOffsetsPreset (preset: LayoutPreset, margin = 0): void {
    this.setAnchorsPreset(preset, false);
    this.setOffsetsPreset(preset, margin);
  }
}
