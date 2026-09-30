import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getTransformedBoxCorners, inverseTransformBoxPoint, transformedBoxContainsPoint, type Matrix3 } from '../math';
import type { MaskConfig } from '../configs/types';
import { maskConfig } from '../configs/builtin-configs';
import type { ConfigChange } from '../configs/config-definition';
import type {
  VFXItem } from '@galacean/effects';
import {
  MouseButton,
  Texture,
  TextureSourceType,
  type InputEventMouseButton,
  type InputEventMouseMotion,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { GizmoType } from '../gizmo-type';
import { GestureCursorType, type GestureCursorResult } from '../cursor';
import { getItemViewTransform } from '../items';
import { toColor, drawCorners, drawWithBoxTransform } from '../drawing';

/**
 * 图片蒙版工具结果
 */
export type MaskResult = {
  /**
   * 蒙版线条列表
   */
  lines: {
    /** 笔刷大小 */
    brushSize: number,
    /** 笔刷路径点（归一化坐标） */
    points: Vector2[],
    /** 笔刷类型：涂抹或擦除 */
    type?: 'paint' | 'erase',
    /** 形状类型：'stroke' 折线（默认），'rect' 矩形框选（points=[起点, 终点]） */
    shape?: 'stroke' | 'rect',
  }[],
};

/** 通过笔刷或矩形涂抹、擦除图片蒙版并实时预览。 */
export class MaskGizmo extends Gizmo {
  /** gizmo 类型标识 */
  type = GizmoType.MASK;

  /** 当前笔刷模式：涂抹或擦除 */
  mode: 'paint' | 'erase' | 'box-paint' | 'box-erase' = 'paint';

  /** 光标结果。 */
  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };

  result: MaskResult = {
    lines: [],
  };

  /** 配置变更退订函数。 */
  private configOff?: () => void;

  /** 当前已加载的黑白蒙版图片。 */
  private maskImage?: HTMLImageElement;

  /** 蒙版图片加载版本，用于丢弃过期异步结果。 */
  private maskImageLoadVersion = 0;

  /** 仅供 draw 使用，由 onUpdate 为当前帧生成。 */
  private renderTransform?: Matrix3;

  /** 离屏 canvas，用于绘制蒙版预览（笔刷涂抹/擦除，原生支持圆头与 destination-out）。 */
  private previewCanvas: HTMLCanvasElement | null = null;

  /** 蒙版预览纹理（由离屏 canvas 每帧上传）。 */
  private maskTexture: Texture | null = null;

  private mouseGrabbed = false;

  /**
   * 创建蒙版 Gizmo，并按当前配置加载基础蒙版图。
   * @param owner Gizmo 宿主。
   */
  constructor (owner: GizmoOwner) {
    super(owner);
    this.configOff = owner.getConfigManager().onChange(
      maskConfig,
      change => {
        this.onConfigChange(change);
      },
    );
    void this.refreshMaskImage(this.config.maskImage);
  }

  /** 当前选中的元素（直读 selection.getSelectedPlayerItems：id→VFXItem 已解析）。 */
  get selectedItems (): VFXItem[] {
    return this._owner.getSelection().getSelectedPlayerItems();
  }

  /** 当前蒙版配置。 */
  get config (): Readonly<MaskConfig> {
    return this._owner.getConfigManager().get(maskConfig);
  }

  /**
   * 更新蒙版绘制或指针光标。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    const transform = this.getSelectionTransform();

    if (this.mouseGrabbed) {
      const handled = this.updateGrab(event, transform);

      this.refreshCursorResult(transform);
      this._owner.setCursor(this.cursorResult);
      if (handled) {
        event.accept();
      }

      return;
    }
    this.refreshCursorResult(transform);
    this._owner.setCursor(this.cursorResult);
  }

  /**
   * 继续当前蒙版绘制交互。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.mouseGrabbed) {
      return;
    }
    const transform = this.getSelectionTransform();
    const handled = this.updateGrab(event, transform);

    this.refreshCursorResult(transform);
    this._owner.setCursor(this.cursorResult);
    if (handled) {
      event.accept();
    }
  }

  /**
   * 在选中元素内开始笔刷或矩形蒙版交互。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    // 步骤 1：校验按键、点击次数和选中元素包围盒。
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    if (event.doubleClick) {
      return;
    }

    const transform = this.getSelectionTransform();

    if (!transform) {
      return;
    }
    const point = new Vector2(event.position.x, event.position.y);

    if (!transformedBoxContainsPoint(transform, point)) {
      return;
    }

    // 步骤 2：矩形模式在元素内创建归一化矩形路径。
    if (this.mode === 'box-paint' || this.mode === 'box-erase') {
      this._owner.setCursor(this.cursorResult);
      this.mouseGrabbed = true;
      this._owner.emit('actionstart', { source: this });
      const start = this.toNormalized(point, transform);

      this.result.lines.push({
        type: this.mode === 'box-paint' ? 'paint' : 'erase',
        shape: 'rect',
        brushSize: 0,
        points: [start, start.clone()],
      });
      event.accept();

      return;
    }

    // 步骤 3：笔刷模式创建空路径，后续由拖拽追加点。
    this._owner.setCursor(this.cursorResult);
    this.mouseGrabbed = true;
    this._owner.emit('actionstart', { source: this });

    this.result.lines.push({
      type: this.mode,
      brushSize: this.config.brushSize,
      points: [],
    });

    event.accept();
  }

  /**
   * 结束蒙版绘制并移除无效路径。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.mouseGrabbed) {
      return;
    }
    this.mouseGrabbed = false;
    const lastLine = this.result.lines[this.result.lines.length - 1];

    if (lastLine?.shape === 'rect') {
      const [a, b] = lastLine.points;
      const transform = this.getSelectionTransform();
      const corners = transform ? getTransformedBoxCorners(transform) : undefined;
      const w = Math.abs((a?.x ?? 0) - (b?.x ?? 0)) * (corners?.[0].distance(corners[1]) ?? 0);
      const h = Math.abs((a?.y ?? 0) - (b?.y ?? 0)) * (corners?.[0].distance(corners[3]) ?? 0);

      if (w < 0.5 && h < 0.5) {
        this.result.lines.pop();
      }
    } else if (lastLine?.points.length === 0) {
      this.result.lines.pop();
    }

    this._owner.emit('actioncommit', { source: this });
    this._owner.setCursor(this.cursorResult);

    event.accept();
  }

  /** 释放预览纹理和离屏绘制资源。 */
  override dispose (): void {
    this.configOff?.();
    this.configOff = undefined;
    this.maskImageLoadVersion++;
    this.maskImage = undefined;
    this.clearRenderObjects();
    super.dispose();
  }

  /** 为本帧绘制创建元素包围盒快照。 */
  override onUpdate (): void {
    this.renderTransform = this.getSelectionTransform();
    this.refreshCursorResult(this.renderTransform);
  }

  /**
   * 绘制蒙版纹理、元素轮廓和矩形预览。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    // 步骤 1：获取本帧包围盒与预览尺寸。
    const transform = this.renderTransform;

    if (!transform) {
      return;
    }

    const { brushAlpha, boxLineWidth, boxLineColor, boxLineAlpha } = this.config;
    const corners = getTransformedBoxCorners(transform);
    const [leftTop, rightTop, , leftBottom] = corners;
    const width = Math.ceil(leftTop.distance(rightTop));
    const height = Math.ceil(leftTop.distance(leftBottom));
    const xAxis = rightTop.clone().subtract(leftTop).normalize();
    const yAxis = leftBottom.clone().subtract(leftTop).normalize();

    // 步骤 2：渲染离屏预览并创建或更新纹理。
    if (width > 0 && height > 0) {
      const canvas = this.renderPreviewToCanvas(width, height);

      if (canvas) {
        if (this.maskTexture && (this.maskTexture.width !== width || this.maskTexture.height !== height)) {
          this.clearRenderObjects();
        }
        if (!this.maskTexture || this.maskTexture.isDestroyed) {
          this.maskTexture = Texture.create(control.engine, {
            sourceType: TextureSourceType.image,
            image: canvas,
            flipY: true,
          });
        } else {
          this.maskTexture.updateSource({
            sourceType: TextureSourceType.image,
            image: canvas,
            flipY: true,
          });
        }
        this.maskTexture.width = width;
        this.maskTexture.height = height;
        drawWithBoxTransform(control, leftTop, xAxis, yAxis, () => {
          control.drawTexture(0, 0, width, height, this.maskTexture!, undefined, toColor(0xFFFFFF, brushAlpha));
        });
      }

      if (this.maskImage) {
        const imageCanvas = this.getMask();

        if (imageCanvas) {
          if (this.maskTexture && (this.maskTexture.width !== width || this.maskTexture.height !== height)) {
            this.clearRenderObjects();
          }
          if (!this.maskTexture || this.maskTexture.isDestroyed) {
            this.maskTexture = Texture.create(control.engine, {
              sourceType: TextureSourceType.image,
              image: imageCanvas,
              flipY: true,
            });
          } else {
            this.maskTexture.updateSource({
              sourceType: TextureSourceType.image,
              image: imageCanvas,
              flipY: true,
            });
          }
          this.maskTexture.width = width;
          this.maskTexture.height = height;
          drawWithBoxTransform(control, leftTop, xAxis, yAxis, () => {
            control.drawTexture(0, 0, width, height, this.maskTexture!, undefined, toColor(0xFFFFFF, brushAlpha));
          });
        }
      }
    }

    // 步骤 3：绘制元素轮廓与正在拖动的矩形。
    drawCorners(control, corners, toColor(boxLineColor, boxLineAlpha), boxLineWidth);

    if (this.mouseGrabbed) {
      const lastLine = this.result.lines[this.result.lines.length - 1];

      if (lastLine?.shape === 'rect' && lastLine.points.length >= 2) {
        const [a, b] = lastLine.points;

        if (a && b) {
          const selCorners = getTransformedBoxCorners(
            transform,
            new Box2(
              new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y)),
              new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y)),
            ),
          );

          drawCorners(control, selCorners, toColor(boxLineColor, boxLineAlpha), boxLineWidth);
        }
      }
    }
  }

  /**
   * 设置模式。
   * @param mode 模式类型：'paint' 笔刷涂抹、'erase' 笔刷擦除、'box-paint' 框选涂抹、'box-erase' 框选擦除
   */
  setMode (mode: 'paint' | 'erase' | 'box-paint' | 'box-erase') {
    this.mode = mode;
  }

  /** 关闭 gizmo：清空蒙版配置、笔刷和预览资源。 */
  close () {
    this._owner.getConfigManager().set(maskConfig, { maskImage: '' });
    this.result.lines = [];
    this.clearRenderObjects();
  }

  /** 清空当前所有笔刷线条。 */
  clearMask () {
    this.result.lines = [];
    this.maskImage = undefined;
  }

  /**
   * 加载蒙版图片。
   * @param url 图片地址
   * @returns Promise<HTMLImageElement>
   */
  public loadMaskImage (url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve(img);
      };
      img.onerror = err => {
        reject(new Error('Failed to load mask image.'));
      };
      img.src = url;
    });
  }

  /**
   * 生成当前蒙版的 PNG Canvas。
   * @returns 蒙版图像；没有有效蒙版时返回 null。
   */
  getMask (): HTMLCanvasElement | null {
    // 步骤 1：创建与选中元素同尺寸的输出画布。
    const transform = this.getSelectionTransform();

    if (!transform) {
      return null;
    }

    const points = getTransformedBoxCorners(transform);
    const width = Math.ceil(points[0].distance(points[1]));
    const height = Math.ceil(points[0].distance(points[3]));

    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    const { maskColor, maskBackgroundColor } = this.config;
    const maskImage = this.maskImage;

    if (this.result.lines.length === 0 && !maskImage) {
      return null;
    }

    const maskHexColor = '#' + maskColor.toString(16).padStart(6, '0');
    const maskBackgroundHexColor = '#' + maskBackgroundColor.toString(16).padStart(6, '0');

    ctx.fillStyle = maskBackgroundHexColor;
    ctx.fillRect(0, 0, width, height);

    // 步骤 2：将基础黑白蒙版映射为主体色和背景色。
    if (maskImage) {
      try {
        ctx.drawImage(maskImage, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const mcR = (maskColor >> 16) & 0xFF;
        const mcG = (maskColor >> 8) & 0xFF;
        const mcB = maskColor & 0xFF;

        const mbcR = (maskBackgroundColor >> 16) & 0xFF;
        const mbcG = (maskBackgroundColor >> 8) & 0xFF;
        const mbcB = maskBackgroundColor & 0xFF;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const brightness = (r + g + b) / 3;

          if (brightness > 128) {
            data[i] = mcR;
            data[i + 1] = mcG;
            data[i + 2] = mcB;
          } else {
            data[i] = mbcR;
            data[i + 1] = mbcG;
            data[i + 2] = mbcB;
          }
        }

        ctx.putImageData(imageData, 0, 0);
      } catch (err) {
        console.warn('Failed to load mask image:', err);
      }
    }

    const scale = GizmoViewportUtils.getViewScale(this._owner.getEngine());

    // 步骤 3：按顺序应用矩形与笔刷路径。
    for (const line of this.result.lines) {
      if (!line || line.points.length === 0) {
        continue;
      }

      if (line.shape === 'rect') {
        const a = line.points[0];
        const b = line.points[1];

        if (!a || !b) {
          continue;
        }
        const x0 = Math.min(a.x, b.x) * width;
        const y0 = Math.min(a.y, b.y) * height;
        const x1 = Math.max(a.x, b.x) * width;
        const y1 = Math.max(a.y, b.y) * height;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = line.type === 'paint' ? maskHexColor : maskBackgroundHexColor;
        ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
        continue;
      }

      ctx.lineWidth = line.brushSize * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';

      if (line.type === 'paint') {
        ctx.strokeStyle = maskHexColor;
      } else {
        ctx.strokeStyle = maskBackgroundHexColor;
      }

      ctx.beginPath();
      for (let j = 0; j < line.points.length; j++) {
        const point = line.points[j];

        if (!point) {
          continue;
        }

        const x = point.x * width;
        const y = point.y * height;

        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // 步骤 4：导出最终 PNG。
    return canvas;
  }

  /**
   * 生成当前蒙版的 PNG Data URL。
   * @returns 蒙版图像；没有有效蒙版时返回 undefined。
   */
  getMaskDataUrl (): string | undefined {
    return this.getMask()?.toDataURL();
  }

  /**
   * 在蒙版图片 URL 变化时刷新运行时图片。
   * @param change 蒙版配置变更。
   */
  private onConfigChange (change: ConfigChange<MaskConfig>): void {
    if (change.previous.maskImage === change.current.maskImage) {
      return;
    }
    void this.refreshMaskImage(change.current.maskImage);
  }

  /**
   * 加载当前配置指定的蒙版图片，并忽略已过期的异步结果。
   * @param url 蒙版图片 URL；空字符串表示清空。
   */
  private async refreshMaskImage (url: string): Promise<void> {
    const loadVersion = ++this.maskImageLoadVersion;

    this.maskImage = undefined;
    this.clearRenderObjects();
    if (!url) {
      return;
    }

    try {
      const image = await this.loadMaskImage(url);

      if (loadVersion !== this.maskImageLoadVersion || this.config.maskImage !== url) {
        return;
      }
      this.maskImage = image;
    } catch (error) {
      if (loadVersion === this.maskImageLoadVersion) {
        console.warn('[MaskGizmo] Failed to load mask image.', error);
      }
    }
  }

  /**
   * 更新当前笔刷路径或矩形终点。
   * @param event 鼠标拖拽事件。
   * @param transform 当前元素投影。
   * @returns 是否处理了拖拽。
   */
  private updateGrab (event: InputEventMouseMotion, transform: Matrix3 | undefined): boolean {
    if (!this.mouseGrabbed) {
      return false;
    }
    if (!transform) {
      return true;
    }

    const lastLine = this.result.lines[this.result.lines.length - 1];

    if (lastLine?.shape === 'rect') {
      lastLine.points[1] = this.toNormalized(new Vector2(event.position.x, event.position.y), transform);

      return true;
    }

    const point = inverseTransformBoxPoint(transform, new Vector2(event.position.x, event.position.y));

    lastLine?.points.push(point);

    return true;
  }

  /**
   * 将视口坐标转换为包围盒内的归一化坐标。
   * @param p 视口坐标。
   * @param transform 元素 Box2 投影。
   * @returns 钳制到 [0, 1] 的归一化坐标。
   */
  private toNormalized (p: Vector2, transform: Matrix3): Vector2 {
    const point = inverseTransformBoxPoint(transform, p);

    return point.clamp(new Vector2(), new Vector2(1, 1));
  }

  /** 按当前元素与视口即时计算投影，不写入业务状态或渲染快照。 */
  private getSelectionTransform (): Matrix3 | undefined {
    const selectedItems = this.selectedItems;

    if (selectedItems.length !== 1) {
      return undefined;
    }

    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);

    return getItemViewTransform(selectedItems[0], containerSize);
  }

  /** 释放预览纹理与离屏 canvas。 */
  private clearRenderObjects (): void {
    if (this.maskTexture && !this.maskTexture.isDestroyed) {
      this.maskTexture.dispose();
    }
    this.maskTexture = null;
    this.previewCanvas = null;
  }

  /**
   * 将蒙版预览绘制到离屏画布。
   * @param width 预览宽度。
   * @param height 预览高度。
   * @returns 离屏画布；创建失败时返回 null。
   */
  private renderPreviewToCanvas (width: number, height: number): HTMLCanvasElement | null {
    // 步骤 1：创建或调整离屏画布并清空内容。
    this.previewCanvas ??= document.createElement('canvas');
    const canvas = this.previewCanvas;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    const { brushColor } = this.config;
    const brushHex = '#' + brushColor.toString(16).padStart(6, '0');
    const scale = GizmoViewportUtils.getViewScale(this._owner.getEngine());

    ctx.clearRect(0, 0, width, height);

    // 步骤 2：使用基础图片裁剪主体颜色。
    if (this.maskImage) {
      ctx.save();
      ctx.fillStyle = brushHex;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.maskImage, 0, 0, width, height);
      ctx.restore();
    }

    // 步骤 3：按顺序叠加或擦除矩形与笔刷路径。
    for (const line of this.result.lines) {
      if (!line || line.points.length === 0) {
        continue;
      }

      if (line.shape === 'rect') {
        const a = line.points[0];
        const b = line.points[1];

        if (a && b) {
          const x0 = Math.min(a.x, b.x) * width;
          const y0 = Math.min(a.y, b.y) * height;
          const x1 = Math.max(a.x, b.x) * width;
          const y1 = Math.max(a.y, b.y) * height;

          if (x1 - x0 > 0.5 || y1 - y0 > 0.5) {
            ctx.save();
            ctx.fillStyle = brushHex;
            ctx.globalCompositeOperation = line.type === 'paint' ? 'source-over' : 'destination-out';
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            ctx.restore();
          }
        }
        continue;
      }

      ctx.save();
      ctx.lineWidth = line.brushSize * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = brushHex;
      ctx.globalCompositeOperation = line.type === 'paint' ? 'source-over' : 'destination-out';

      ctx.beginPath();
      for (let j = 0; j < line.points.length; j++) {
        const point = line.points[j];

        if (!point) {
          continue;
        }
        const x = point.x * width;
        const y = point.y * height;

        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 步骤 4：返回供纹理上传的画布。
    return canvas;
  }

  /**
   * 根据指针位置和蒙版模式刷新光标。
   * @param transform 当前元素投影。
   */
  private refreshCursorResult (transform: Matrix3 | undefined) {
    const point = this._owner.getMousePosition();

    this.cursorResult = {
      type: GestureCursorType.NORMAL,
      angle: 0,
    };

    if (!point || !transform) {
      return;
    }

    if (!transformedBoxContainsPoint(transform, point)) {
      return;
    }

    if (this.mode === 'box-paint' || this.mode === 'box-erase') {
      this.cursorResult = { type: GestureCursorType.BOX_SELECT, angle: 0 };

      return;
    }

    this.cursorResult = {
      type: GestureCursorType.CIRCLE,
      angle: 0,
      radius: this.config.brushSize * GizmoViewportUtils.getViewScale(this._owner.getEngine()) / 2,
    };
  }
}
