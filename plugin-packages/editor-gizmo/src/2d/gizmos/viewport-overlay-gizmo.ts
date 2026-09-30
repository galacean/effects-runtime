import { SceneServer } from '@galacean/effects';
import { Texture, FrameComponent, spec } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import type { Matrix3 } from '../math';
import { Vector2, Vector3, getBoxTransform, getBoxTransformFromBox, getTransformedBox, getTransformedBoxCorners } from '../math';
import { Gizmo } from '../gizmo';
import { GizmoType } from '../gizmo-type';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import type { ViewportOverlayConfig } from '../configs/types';
import { viewportOverlayConfig } from '../configs/builtin-configs';
import { drawCorners, drawWithBoxTransform, fillBoxByCorners, toColor } from '../drawing';
import { getItemViewBox, getItemViewTransform, isFramePlayerItem } from '../items';
import { projectPoint } from '../viewport';

/** 视口画板与安全区配置。 */
export type ViewProperty = {
  /** 画板（设计稿）尺寸 [宽, 高]，单位为设计稿像素 */
  size: [number, number],
  /** 出血安全区 [上, 下, 左, 右]，单位为设计稿像素，相对画板边缘的边距 */
  safeArea: [number, number, number, number],
  /** 预览安全区列表 */
  previewSafeAreas: {
    /** 安全区包围盒 [左, 上, 宽, 高]，单位为设计稿像素，相对画板左上角 */
    box: [number, number, number, number],
    /** 填充色 [r, g, b, a?]，0..255 */
    color?: number[],
    /** 背景贴图地址 */
    url?: string,
    /** 是否可见 */
    visible?: boolean,
  }[],
};

/** 视口展示 gizmo：绘制画板边框、画框外遮罩、出血与预览安全区。 */
export class ViewportOverlayGizmo extends Gizmo {
  readonly type = GizmoType.VIEWPORT_OVERLAY;

  /** 遮挡层绘制结果（画板视口盒） */
  box = new Box2();

  /** 主视口归一化 Box2 到屏幕的变换。 */
  transform: Matrix3 | undefined;

  /** 视图属性（由外部设置） */
  viewProperty: ViewProperty | undefined;

  /** 外部提供的主视口包围盒计算函数。 */
  mainViewportBoxProvider: (() => Box2 | null) | undefined;

  /** previewSafeAreas 贴图缓存：url → Texture（避免每帧重建） */
  private safeAreaTextures = new Map<string, Texture>();
  /** previewSafeAreas 贴图加载 Promise：url → Promise<Texture>（防重入，加载完写入 safeAreaTextures） */
  private safeAreaTexturePromises = new Map<string, Promise<Texture>>();

  /** 当前视口覆盖层配置。 */
  get config (): Readonly<ViewportOverlayConfig> {
    return this._owner.getConfigManager().get(viewportOverlayConfig);
  }

  /** 刷新当前画板或主视口的屏幕包围盒。 */
  override onUpdate (): void {
    // 步骤 1：优先使用外部提供的主视口包围盒。
    if (this.mainViewportBoxProvider) {
      this.box = this.mainViewportBoxProvider() ?? new Box2();
      this.transform = getBoxTransformFromBox(this.box);

      return;
    }
    // 步骤 2：查找主合成蒙版元素。
    const composition = this._owner.getEngine().getServer(SceneServer).compositions[0];
    const maskFrame = composition?.items.find(item =>
      item.type === spec.ItemType.null
      && item.getComponent(FrameComponent) !== undefined
      && item.name === '主合成蒙版',
    );

    if (maskFrame) {
      const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);

      this.box = getItemViewBox(maskFrame, containerSize);
      this.transform = getItemViewTransform(maskFrame, containerSize);

      return;
    }
    // 步骤 3：回退到真实画板元素。
    const frameItem = composition?.items.find(item => isFramePlayerItem(item));

    if (frameItem) {
      const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);

      this.box = getItemViewBox(frameItem, containerSize);
      this.transform = getItemViewTransform(frameItem, containerSize);

      return;
    }
    // 步骤 4：按预览尺寸投影居中的主视口矩形。
    if (!this.viewProperty) {
      this.box = new Box2();
      this.transform = undefined;

      return;
    }
    const anyItem = composition?.items.find(item => item.composition?.camera);

    if (!composition?.camera || !anyItem) {
      this.box = new Box2();
      this.transform = undefined;

      return;
    }
    this.transform = this.projectPreviewBox(anyItem, this.viewProperty.size);
    this.box = this.transform ? getTransformedBox(this.transform) : new Box2();
  }

  /**
   * 绘制画板外遮罩、安全区与画板边框。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    const transform = this.transform;

    if (this.box.isEmpty() || !transform) {
      return;
    }
    const corners = getTransformedBoxCorners(transform);
    const {
      boxWidth,
      boxColor,
      outerMaskEnabled,
      markColor,
      markAlpha,
      safeAreaEnabled,
      safeAreaBoxColor,
      safeAreaBoxAlpha,
    } = this.config;

    // 步骤 1：绘制画板外遮罩。
    if (outerMaskEnabled) {
      const markFill = toColor(markColor, markAlpha);
      const size = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
      const screen = [new Vector2(), new Vector2(size.x, 0), size.clone(), new Vector2(0, size.y)];

      fillBoxByCorners(control, [screen[0], screen[1], corners[1], corners[0]], markFill);
      fillBoxByCorners(control, [screen[1], screen[2], corners[2], corners[1]], markFill);
      fillBoxByCorners(control, [screen[2], screen[3], corners[3], corners[2]], markFill);
      fillBoxByCorners(control, [screen[3], screen[0], corners[0], corners[3]], markFill);
    }

    // 步骤 2：绘制出血安全区。
    if (safeAreaEnabled && this.viewProperty) {
      const { size, safeArea } = this.viewProperty;
      const [top, bottom, left, right] = safeArea;
      const safeFill = toColor(safeAreaBoxColor, safeAreaBoxAlpha);
      const topRatio = top / size[1];
      const bottomRatio = bottom / size[1];
      const leftRatio = left / size[0];
      const rightRatio = right / size[0];

      fillBoxByCorners(control, getTransformedBoxCorners(transform, new Box2(new Vector2(0, 0), new Vector2(1, topRatio))), safeFill);
      fillBoxByCorners(control, getTransformedBoxCorners(transform, new Box2(new Vector2(0, topRatio), new Vector2(leftRatio, 1))), safeFill);
      fillBoxByCorners(control, getTransformedBoxCorners(transform, new Box2(new Vector2(1 - rightRatio, topRatio), new Vector2(1, 1))), safeFill);
      fillBoxByCorners(control, getTransformedBoxCorners(transform, new Box2(new Vector2(leftRatio, 1 - bottomRatio), new Vector2(1 - rightRatio, 1))), safeFill);

      // 步骤 3：绘制预览安全区的颜色或贴图。
      for (const previewSafeArea of this.viewProperty.previewSafeAreas) {
        const { box: [px, py, pw, ph], color, url, visible } = previewSafeArea;

        if (visible === false) {
          continue;
        }
        const previewCorners = getTransformedBoxCorners(transform, new Box2(
          new Vector2(px / size[0], py / size[1]),
          new Vector2((px + pw) / size[0], (py + ph) / size[1]),
        ));

        if (url) {
          const texture = this.getSafeAreaTexture(url, control.engine);

          if (!texture) {
            continue;
          }
          const [leftTop, rightTop, , leftBottom] = previewCorners;
          const xAxis = rightTop.clone().subtract(leftTop);
          const yAxis = leftBottom.clone().subtract(leftTop);

          drawWithBoxTransform(control, leftTop, xAxis, yAxis, () => {
            control.drawTexture(0, 0, 1, 1, texture);
          });
        } else {
          const alpha = color?.[3] ?? 0.3;
          const cr = color?.[0] ?? 255;
          const cg = color?.[1] ?? 0;
          const cb = color?.[2] ?? 0;
          const resultColor = (cr << 16) | (cg << 8) | cb;

          fillBoxByCorners(control, previewCorners, toColor(resultColor, alpha));
        }
      }
    }

    // 步骤 4：绘制画板边框。
    drawCorners(control, corners, toColor(boxColor, 1), boxWidth);
  }

  /** 释放预览安全区贴图缓存，调用父类释放。 */
  override dispose (): void {
    this.safeAreaTextures.forEach(texture => {
      if (!texture.isDestroyed) {
        texture.dispose();
      }
    });
    this.safeAreaTextures.clear();
    this.safeAreaTexturePromises.clear();
    super.dispose();
  }

  /**
   * 将居中的预览矩形投影为屏幕包围盒。
   * @param item 提供合成相机的播放器元素。
   * @param size 预览尺寸。
   * @returns 主视口屏幕包围盒。
   */
  private projectPreviewBox (item: import('@galacean/effects').VFXItem, size: [number, number]): Matrix3 | undefined {
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const w = size[0] / 2;
    const h = size[1] / 2;
    const points = [
      new Vector3(-w, h, 0),
      new Vector3(w, h, 0),
      new Vector3(w, -h, 0),
      new Vector3(-w, -h, 0),
    ].map(p => projectPoint(p, item, containerSize));

    return getBoxTransform(points);
  }

  /**
   * 获取预览安全区贴图（懒加载）。命中且未销毁则直接返回；否则发起一次异步加载并返回
   * undefined（本帧跳过该贴图，加载完成后由持续渲染循环自动重绘）。与 IconGizmo 同模式。
   * @param url 贴图地址
   * @param engine effects 引擎实例（取自 control）
   * @returns 命中且未销毁的缓存纹理；未命中且发起异步加载时返回 undefined
   */
  private getSafeAreaTexture (url: string, engine: Control['engine']): Texture | undefined {
    const cached = this.safeAreaTextures.get(url);

    if (cached && !cached.isDestroyed) {
      return cached;
    }
    if (!this.safeAreaTexturePromises.has(url)) {
      const promise = Texture.fromImage(url, engine).then(texture => {
        this.safeAreaTextures.set(url, texture);

        return texture;
      });

      this.safeAreaTexturePromises.set(url, promise);
    }

    return undefined;
  }
}
