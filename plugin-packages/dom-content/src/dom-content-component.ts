import type { Engine, Renderer } from '@galacean/effects';
import {
  MaskableGraphic, effectsClass, math, logger, Texture, glContext, canvasPool,
} from '@galacean/effects';
import { renderDOMToImage } from './dom-to-texture';

const DATA_TYPE = 'DomContentComponent';
const MAX_TEXTURE_SIZE = 2048;
/** 单次 setContent 接受的 HTML 最大字符数，避免攻击者传入超大字符串造成 OOM/CPU 耗尽 */
const MAX_HTML_LENGTH = 1024 * 1024; // 1M 字符
/** alpha 修复用的极小值，避免 canvas 完全透明像素被某些浏览器优化为 0 */
const ALPHA_FIX_VALUE = 1 / 255;

/** DOM 内容组件：将 HTML/CSS 渲染为纹理，自动检测并覆盖同 item 上其他 MaskableGraphic 组件纹理 */
@effectsClass(DATA_TYPE)
export class DomContentComponent extends MaskableGraphic {
  htmlContent = '';
  contentWidth = 300;
  contentHeight = 200;
  contentScale = 1;

  /** 用于将 HTML 渲染结果转为纹理数据的离屏 canvas，独占持有，直到 onDestroy 才归还 */
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  isDirty: boolean;

  private rendering = false;
  private _disposed = false;
  private targetComponent: MaskableGraphic | null = null;
  private renderVersion = 0;
  /** 由本组件创建的纹理集合，仅这些纹理可被 dispose */
  private ownedTextures = new Set<Texture>();
  /** 保存 target 组件的原始纹理，用于组件销毁时恢复 */
  private originalTargetTexture: Texture | null = null;

  constructor (engine: Engine) {
    super(engine);
    this.isDirty = false;
    // 本组件的 updateTexture 是异步的，需要独占 canvas 直到 onDestroy。
    this.canvas = canvasPool.getCanvas();
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  setContent (html: string, width?: number, height?: number, scale?: number): void {
    if (typeof html !== 'string') {
      logger.warn('DomContentComponent.setContent: html must be a string, ignored.');

      return;
    }
    if (html.length > MAX_HTML_LENGTH) {
      logger.warn(`DomContentComponent.setContent: html length (${html.length}) exceeds limit (${MAX_HTML_LENGTH}), truncated.`);
      this.htmlContent = html.slice(0, MAX_HTML_LENGTH);
    } else {
      this.htmlContent = html;
    }
    if (width !== undefined) { this.contentWidth = Math.max(0, width); }
    if (height !== undefined) { this.contentHeight = Math.max(0, height); }
    if (scale !== undefined) { this.contentScale = Math.max(0, scale); }
    this.isDirty = true;
    this.renderVersion++;
  }

  override onAwake (): void {
    this.material.setColor('_Color', new math.Color(1, 1, 1, 1));
    if (this.item) {
      for (const comp of this.item.getComponents(MaskableGraphic)) {
        if (comp !== this) {
          this.targetComponent = comp;
          logger.info(`DomContentComponent: Bound to ${comp.constructor.name}, overriding texture.`);

          break;
        }
      }
    }
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    if (this.isDirty && !this.rendering) {
      this.isDirty = false;
      this.updateTexture().catch(e => {
        logger.error('DomContentComponent: Unhandled error in updateTexture.', e);
      });
    }
  }

  override render (renderer: Renderer): void {
    if (this.targetComponent) { return; }
    super.render(renderer);
  }

  override onDestroy (): void {
    super.onDestroy();
    this._disposed = true;
    this.disposeOwnTexture();

    // 恢复 target 组件的原始纹理
    if (this.targetComponent?.renderer && this.originalTargetTexture) {
      void this.targetComponent.setTexture(this.originalTargetTexture);
    }

    // 仅 dispose 由本组件创建的纹理
    for (const tex of this.ownedTextures) {
      tex.dispose();
    }
    this.ownedTextures.clear();
    this.originalTargetTexture = null;

    if (this.canvas) {
      canvasPool.saveCanvas(this.canvas);
    }
    this.targetComponent = null;
  }

  /**
   * 释放当前 renderer 上挂载的纹理（白纹理是引擎共享资源，不应释放）。
   */
  private disposeOwnTexture (): void {
    const texture = this.renderer.texture;

    if (texture && texture !== this.engine.whiteTexture) {
      texture.dispose();
    }
  }

  /**
   * 将一张 image 绘制到内部 canvas，并据此创建纹理写入到本组件 renderer / material。
   *
   * @param width - 纹理宽度（像素）
   * @param height - 纹理高度（像素）
   * @param flipY - 是否翻转 Y 轴；为 false 时通过 canvas 变换预先翻转
   * @param drawCallback - 实际绘制回调，接收已重置变换并清空的 2D 上下文
   */
  private renderImageToTexture (
    width: number,
    height: number,
    flipY: boolean,
    drawCallback: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    if (!this.context || !this.canvas) {
      return;
    }

    const context = this.context;

    context.save();
    this.canvas.width = width;
    this.canvas.height = height;
    context.setTransform(1, 0, 0, 1, 0, 0);

    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    context.clearRect(0, 0, width, height);
    // 设置 alpha 修复用填充色（不实际输出像素，避免完全透明被某些浏览器优化）
    context.fillStyle = `rgba(255, 255, 255, ${ALPHA_FIX_VALUE})`;

    drawCallback(context);

    context.restore();

    const imageData = context.getImageData(0, 0, width, height);
    const texture = Texture.createWithData(
      this.engine,
      {
        data: new Uint8Array(imageData.data),
        width: imageData.width,
        height: imageData.height,
      },
      {
        flipY,
        magFilter: glContext.LINEAR,
        minFilter: glContext.LINEAR,
        wrapS: glContext.CLAMP_TO_EDGE,
        wrapT: glContext.CLAMP_TO_EDGE,
      },
    );

    this.disposeOwnTexture();
    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
    this.ownedTextures.add(texture);
  }

  private async updateTexture (): Promise<void> {
    const startVersion = this.renderVersion;
    const { htmlContent, contentWidth, contentHeight, contentScale } = this;

    if (!htmlContent || contentWidth <= 0 || contentHeight <= 0) { return; }

    if (contentScale <= 0) {
      logger.warn('DomContentComponent: contentScale must be positive, skipping render.');

      return;
    }

    const texWidth = Math.min(Math.round(contentWidth * contentScale), MAX_TEXTURE_SIZE);
    const texHeight = Math.min(Math.round(contentHeight * contentScale), MAX_TEXTURE_SIZE);

    // 计算调整后的 scale，确保 renderDOMToImage 生成的图片不超过 MAX_TEXTURE_SIZE
    const cappedScaleX = texWidth / contentWidth;
    const cappedScaleY = texHeight / contentHeight;
    const cappedScale = Math.min(cappedScaleX, cappedScaleY);

    this.rendering = true;
    try {
      const image = await renderDOMToImage(htmlContent, contentWidth, contentHeight, cappedScale);

      // 检查是否被 dispose 或版本号已变化
      if (this._disposed || startVersion !== this.renderVersion) { return; }

      if (this.targetComponent) {
        this.updateTargetTexture(image, texWidth, texHeight);
      } else {
        this.renderImageToTexture(texWidth, texHeight, true, ctx => {
          ctx.drawImage(image, 0, 0, texWidth, texHeight);
        });
      }
    } catch (e) {
      logger.error('DomContentComponent: Failed to render texture.', e);
    } finally {
      this.rendering = false;
      // 排空脏标记：无论 renderVersion 是否变化，只要有待处理的更新就触发
      if (this.isDirty && !this._disposed) {
        const pending = this.isDirty;

        this.isDirty = false;
        if (pending) {
          this.updateTexture().catch(e => {
            logger.error('DomContentComponent: Unhandled error in updateTexture.', e);
          });
        }
      }
    }
  }

  private updateTargetTexture (image: HTMLImageElement, width: number, height: number): void {
    if (!this.canvas || !this.context || !this.targetComponent) { return; }

    const ctx = this.context;
    const target = this.targetComponent;

    // 检查 target 的 renderer 是否存在
    if (!target.renderer) {
      logger.warn('DomContentComponent: targetComponent.renderer is null, skipping texture update.');

      return;
    }

    // 保存 target 的原始纹理（仅首次）
    const currentTexture = target.renderer.texture;

    if (this.originalTargetTexture === null) {
      this.originalTargetTexture = currentTexture ?? null;
    }

    // 仅 dispose 由本组件创建的纹理，不触碰原始/共享纹理
    if (currentTexture && this.ownedTextures.has(currentTexture)) {
      currentTexture.dispose();
      this.ownedTextures.delete(currentTexture);
    }

    ctx.save();
    this.canvas.width = width;
    this.canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();

    const imageData = ctx.getImageData(0, 0, width, height);

    const texture = Texture.createWithData(
      this.engine,
      {
        data: new Uint8Array(imageData.data),
        width: imageData.width,
        height: imageData.height,
      },
      {
        flipY: true,
        magFilter: glContext.LINEAR,
        minFilter: glContext.LINEAR,
        wrapS: glContext.CLAMP_TO_EDGE,
        wrapT: glContext.CLAMP_TO_EDGE,
      },
    );

    // 将新创建的纹理标记为本组件所有
    this.ownedTextures.add(texture);
    void target.setTexture(texture);
  }
}
