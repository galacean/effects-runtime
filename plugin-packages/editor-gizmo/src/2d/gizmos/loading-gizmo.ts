import type { VFXItem } from '@galacean/effects';
import { EffectComponent, Geometry, glContext, Material, spec } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Box2, Plane } from '@galacean/effects-math/es/extension/index';
import type { Matrix4 } from '../math';
import { Vector2, Vector3, getBoxByNormalizeBox, getNormalizeBoxByBoxes, scaleBox } from '../math';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import {
  VFXItemFactory,
  getPlayerItemById,
  getItemViewBox,
} from '../items';
import {
  viewPositionToWorld,
  viewSizeToWorld,
} from '../viewport/coordinates';
import {
  BASELINE_SYMBOL,
  CONTROL_TEXT_GLYPH_PADDING,
  METRICS_STRING,
  toColor,
  measureTextMetrics,
  type MeasuredTextMetrics,
} from '../drawing';
import type { LoadingConfig } from '../configs/types';
import type { ConfigChange } from '../configs/config-definition';
import { loadingConfig } from '../configs/loading-config';
import type { LoadingItemOptions, LoadingItemState, LoadingManager } from './loading-manager';

const LOADING_TIP_FONT_SIZE = 16;
const LOADING_TIP_FONT_FAMILY = 'sans-serif';
const LOADING_TIP_COLOR = 0x000000;

/** 为目标元素叠加加载动画与提示文案。 */
export class LoadingGizmo extends Gizmo {
  readonly type = 'loading';
  private configOff?: () => void;
  private managerOff?: () => void;
  private readonly manager: LoadingManager;
  private readonly loadingBoxSize = new Vector2();
  private _idMap = new Map<string, {
    /** 归一化加载区域。 */
    loadingBox: Box2,
    /** 加载动画渲染对象。 */
    loadingVFXItem: VFXItem,
    /** 加载提示配置。 */
    tip: LoadingItemOptions,
  }>();

  /**
   * 创建加载覆盖层。
   * @param owner Gizmo 宿主。
   * @param manager 加载状态管理器。
   */
  constructor (owner: GizmoOwner, manager: LoadingManager) {
    super(owner);
    this.manager = manager;
    this.configOff = owner.getConfigManager().onChange(
      loadingConfig,
      change => {
        this.onConfigChange(change);
      },
    );
    this.managerOff = this.manager.on('change', () => {
      this.syncManager();
    });
    this.syncManager();
  }

  /** 当前 Gizmo 实例持有的可销毁渲染投影。 */
  get idMap () {
    return this._idMap;
  }

  /** 当前 loading 元素 id 列表（由稳定 manager 派生）。 */
  get loadingIds (): string[] {
    return this.manager.ids;
  }

  /** 当前加载覆盖层配置。 */
  private get config (): Readonly<LoadingConfig> {
    return this._owner.getConfigManager().get(loadingConfig);
  }

  /**
   * 订阅 loading 集合变化：add/delete 后回调当前全量 id 列表。
   * @param cb 收到当前全量 loading id 列表的回调
   * @returns 退订函数，调用后取消对应监听
   */
  onLoadingChange (cb: (ids: string[]) => void): () => void {
    return this.manager.on('change', change => {
      if (change.addedIds.length > 0 || change.removedIds.length > 0) {
        cb(change.ids);
      }
    });
  }

  /**
   * 为指定元素添加 loading 覆盖层；同一元素不可重复添加。
   * @param id 目标元素 ID
   * @param options loading 配置（文案、位置、自定义区域、是否清空选中）
   */
  add (id: string, options?: LoadingItemOptions) {
    this.manager.add(id, options);
  }

  /**
   * 移除指定元素的 loading 覆盖层并释放对应 VFXItem。
   * @param id 目标元素 ID
   */
  delete (id: string) {
    this.manager.delete(id);
  }

  /**
   * 更新指定 loading 元素的提示文案。
   * @param id 目标元素 ID
   * @param options 待合并更新的 LoadingTip 属性
   */
  updateItem (id: string, options: LoadingItemOptions) {
    this.manager.update(id, options);
  }

  /** 根据目标元素的实时包围盒刷新加载动画。 */
  override onUpdate (): void {
    if (this._idMap.size === 0) {
      return;
    }
    for (const [id, loadingItem] of this._idMap) {
      this.updateLoadingVFXItemTransform(id, loadingItem);
    }
  }

  /**
   * 绘制所有加载提示文案。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    if (this._idMap.size === 0) {
      return;
    }

    for (const [id, loadingItem] of this._idMap) {
      if (!loadingItem.tip?.text) {
        continue;
      }
      const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], id);
      const itemBox = item
        ? getItemViewBox(item, GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!))
        : new Box2();
      const loadingBox = getBoxByNormalizeBox(itemBox, loadingItem.loadingBox);

      this.drawLoadingTip(control, loadingBox, itemBox, loadingItem.tip);
    }
  }

  /** 释放当前实例的渲染投影；稳定 LoadingManager 不随 Gizmo 重建清空。 */
  override dispose (): void {
    this.configOff?.();
    this.configOff = undefined;
    this.managerOff?.();
    this.managerOff = undefined;
    this._idMap.forEach(loadingItem => {
      this.disposeLoadingVFXItem(loadingItem.loadingVFXItem);
    });
    this._idMap.clear();
    super.dispose();
  }

  /**
   * 在片元着色器变化时重建加载动画对象。
   * @param change 加载配置变更。
   */
  private onConfigChange (change: ConfigChange<LoadingConfig>): void {
    if (change.previous.loadingFragment === change.current.loadingFragment) {
      return;
    }
    for (const [id, loadingItem] of this._idMap) {
      this.disposeLoadingVFXItem(loadingItem.loadingVFXItem);
      loadingItem.loadingVFXItem = this.createLoadingVFXItem();
      this.updateLoadingVFXItemTransform(id, loadingItem);
    }
  }

  /**
   * 绘制单条加载提示，并将文本限制在加载区域内。
   * @param control 绘制控制器。
   * @param loadingBox 加载区域。
   * @param itemBox 目标元素包围盒。
   * @param tip 加载提示配置。
   */
  private drawLoadingTip (control: Control, loadingBox: Box2, itemBox: Box2, tip: LoadingItemOptions): void {
    // 步骤 1：计算提示位置与可用宽度。
    const { x: width, y: height } = loadingBox.getSize(this.loadingBoxSize);

    if (!tip.text || !Number.isFinite(width) || width <= 0) {
      return;
    }

    const positionedLeft = tip.position
      ? itemBox.min.x + (Number.isFinite(tip.position.x) ? tip.position.x : 0)
      : loadingBox.min.x;
    const left = tip.position
      ? Math.min(Math.max(positionedLeft, loadingBox.min.x), loadingBox.max.x)
      : loadingBox.min.x;
    const availableWidth = tip.position ? loadingBox.max.x - left : width;

    if (availableWidth <= 0) {
      return;
    }

    /**
     * 测量加载提示的粗体字形。
     * @param text 提示文本。
     * @param fontSize 字号。
     * @returns 文本字形尺寸。
     */
    const measureTipText = (text: string, fontSize: number): MeasuredTextMetrics => {
      const metrics = measureTextMetrics(text, fontSize, LOADING_TIP_FONT_FAMILY, 'bold');

      return {
        width: metrics.width || Array.from(text).length * fontSize,
        actualBoundingBoxAscent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
        actualBoundingBoxDescent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
      };
    };

    // 步骤 2：测量文本并缩小字号以适应可用宽度。
    const measuredAtBaseSize = measureTipText(tip.text, LOADING_TIP_FONT_SIZE);
    let fontSize = measuredAtBaseSize.width > availableWidth
      ? LOADING_TIP_FONT_SIZE * availableWidth / measuredAtBaseSize.width
      : LOADING_TIP_FONT_SIZE;
    let textMetrics = measureTipText(tip.text, fontSize);

    if (textMetrics.width > availableWidth) {
      fontSize *= availableWidth / textMetrics.width;
      textMetrics = measureTipText(tip.text, fontSize);
    }

    // 步骤 3：按字形基线计算最终绘制位置。
    const textLeft = tip.position ? left : loadingBox.min.x + (width - textMetrics.width) / 2;
    const inkHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
    const top = tip.position
      ? itemBox.min.y + (Number.isFinite(tip.position.y) ? tip.position.y : 0)
      : loadingBox.min.y + (height - inkHeight) / 2;
    const probeMetrics = measureTipText(METRICS_STRING + BASELINE_SYMBOL, fontSize);
    const inkTopFromCellTop = CONTROL_TEXT_GLYPH_PADDING
      + probeMetrics.actualBoundingBoxAscent
      - textMetrics.actualBoundingBoxAscent;

    control.drawText(
      textLeft,
      top - inkTopFromCellTop,
      tip.text,
      fontSize,
      toColor(LOADING_TIP_COLOR, 1),
      LOADING_TIP_FONT_FAMILY,
      'bold',
    );
  }

  /** 将可销毁的渲染投影同步到当前加载状态。 */
  private syncManager (): void {
    const activeIds = new Set(this.manager.ids);

    for (const [id, loadingItem] of this._idMap) {
      if (!activeIds.has(id)) {
        this.disposeLoadingVFXItem(loadingItem.loadingVFXItem);
        this._idMap.delete(id);
      }
    }
    for (const id of activeIds) {
      const state = this.manager.get(id);

      if (!state) {
        continue;
      }
      const existing = this._idMap.get(id);

      if (existing) {
        existing.tip = {
          ...state.tip,
          position: state.tip.position ? state.tip.position.clone() : undefined,
        };
      } else {
        this.createProjection(id, state);
      }
    }
  }

  /**
   * 为加载状态创建渲染投影。
   * @param id 目标元素 ID。
   * @param state 加载状态。
   */
  private createProjection (id: string, state: LoadingItemState): void {
    const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], id);
    const itemViewBox = item
      ? getItemViewBox(item, GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!))
      : new Box2();
    const currentBox = state.loadingBox
      ? this.getViewBoxByPixelBox(state.loadingBox)
      : itemViewBox;

    this._idMap.set(id, {
      loadingBox: getNormalizeBoxByBoxes(itemViewBox, currentBox),
      loadingVFXItem: this.createLoadingVFXItem(),
      tip: {
        ...state.tip,
        position: state.tip.position ? state.tip.position.clone() : undefined,
      },
    });
    this.updateLoadingVFXItemTransform(id, this._idMap.get(id)!);
  }

  /** @returns 当前相机信息。 */
  private getCameraInfo (): { position: Vector3, matrix: Matrix4 } {
    return GizmoViewportUtils.getCameraInfo(this._owner.getEngine());
  }

  /** @returns 当前视口的缩放、平移与尺寸。 */
  private getViewportParams (): { scale: number, translation: Vector2, width: number, height: number } {
    const composition = this._owner.getEngine().sceneServer.compositions[0];
    const camera = composition?.camera;

    if (camera) {
      const viewportMatrix = camera.getViewportMatrix();
      const scale = viewportMatrix.elements[0];
      const translation = new Vector2(viewportMatrix.elements[12], viewportMatrix.elements[13]);
      const width = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!).x;
      const height = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!).y;

      return { scale, translation, width, height };
    }

    return { scale: 1, translation: new Vector2(), width: GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!).x, height: GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!).y };
  }

  /**
   * 将视图坐标下的包围盒按当前视口缩放与平移变换为实际渲染包围盒。
   * @param box 视图坐标下的包围盒
   * @returns 经视口缩放与平移后的实际渲染包围盒
   */
  private getViewBoxByPixelBox (box: Box2): Box2 {
    const { scale, translation, width, height } = this.getViewportParams();
    const center = new Vector2(width / 2, height / 2);
    const result = scaleBox(box.clone(), scale, center).translate(translation);

    return result;
  }

  /**
   * 创建承载加载动画的 VFXItem。
   * @returns 已绑定几何与材质的加载动画对象。
   */
  private createLoadingVFXItem () {
    // 步骤 1：创建加载动画对象与平面几何。
    const composition = this._owner.getEngine().sceneServer.compositions[0];
    const loadingVFXItem = VFXItemFactory.createVFXItem(composition, null, 'LoadingVFXItem', EffectComponent);

    this._owner.getSelection().addIgnoreIds([loadingVFXItem.getInstanceId()]);
    loadingVFXItem.type = spec.ItemType.effect;
    const effects = loadingVFXItem.getComponent(EffectComponent);
    const engine = this._owner.getEngine();
    const geometry = Geometry.create(engine, {
      attributes: {
        aPos: {
          size: 3,
          data: new Float32Array([
            -0.5, -0.5, 0,
            0.5, -0.5, 0,
            0.5, 0.5, 0,
            -0.5, 0.5, 0,
          ]),
        },
        aUV: {
          size: 2,
          data: new Float32Array([
            0, 0,
            1, 0,
            1, 1,
            0, 1,
          ]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 0, 2, 3]) },
      mode: glContext.TRIANGLES,
      drawCount: 6,
    });
    // 步骤 2：使用当前配置创建动画材质。
    const material = Material.create(engine, {
      shader: {
        vertex: `
precision highp float;
attribute vec3 aPos;
attribute vec2 aUV;
uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}`,
        fragment: this.config.loadingFragment,
      },
    });

    // 步骤 3：绑定运行时几何与材质。
    // @ts-expect-error Effects 类型未暴露可写 geometry。
    effects.geometry = geometry;
    effects.material = material;

    return loadingVFXItem;
  }

  /** 释放 loading 渲染对象，并同步恢复 Selection 的命中过滤。 */
  private disposeLoadingVFXItem (item: VFXItem): void {
    this._owner.getSelection().deleteIgnoreIds([item.getInstanceId()]);
    item.dispose();
  }

  /**
   * 按目标元素的实时包围盒更新加载动画变换。
   * @param id 目标元素 ID。
   * @param loadingItem 对应的加载渲染投影。
   */
  private updateLoadingVFXItemTransform (id: string, loadingItem: { loadingBox: Box2, loadingVFXItem: VFXItem }): void {
    const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], id);
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const itemViewBox = item ? getItemViewBox(item, containerSize) : new Box2();
    const currentBox = getBoxByNormalizeBox(itemViewBox, loadingItem.loadingBox);

    const viewPosition = new Vector2((currentBox.max.x + currentBox.min.x) / 2, (currentBox.max.y + currentBox.min.y) / 2);
    const cameraInfo = this.getCameraInfo();
    const interactionPlane = new Plane(0, new Vector3(0, 0, 1));
    const worldPosition = viewPositionToWorld(viewPosition, cameraInfo, interactionPlane, containerSize);
    const viewSize = new Vector2(currentBox.max.x - currentBox.min.x, currentBox.max.y - currentBox.min.y);
    const worldSize = viewSizeToWorld(viewSize, containerSize, loadingItem.loadingVFXItem, cameraInfo, interactionPlane);

    if (worldPosition) {
      loadingItem.loadingVFXItem.transform.setPosition(worldPosition.x, worldPosition.y, 0);
    }
    loadingItem.loadingVFXItem.transform.setScale(worldSize.x, worldSize.y, 1);
  }

}
