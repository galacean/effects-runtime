/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { Engine, Renderer } from '@galacean/effects';
import {
  MaskableGraphic, effectsClass, math, logger, applyMixins, TextComponentBase, Texture, glContext, canvasPool,
} from '@galacean/effects';
import { renderDOMToImage } from './dom-to-texture';

const DATA_TYPE = 'DomContentComponent';
const MAX_TEXTURE_SIZE = 2048;

export interface DomContentComponent extends TextComponentBase { }

/** DOM 内容组件：将 HTML/CSS 渲染为纹理，自动检测并覆盖同 item 上其他 MaskableGraphic 组件纹理 */
@effectsClass(DATA_TYPE)
export class DomContentComponent extends MaskableGraphic {
  htmlContent = '';
  contentWidth = 300;
  contentHeight = 200;
  contentScale = 1;

  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  isDirty: boolean;

  private rendering = false;
  private _disposed = false;
  private targetComponent: MaskableGraphic | null = null;
  private renderVersion = 0;
  constructor (engine: Engine) {
    super(engine);
    this.isDirty = false;
    // 不调用 initTextBase（它会立即将 canvas 归还到池中），
    // 因为本组件的 updateTexture 是异步的，需要独占 canvas 直到 onDestroy。
    this.canvas = canvasPool.getCanvas();
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  setContent (html: string, width?: number, height?: number, scale?: number): void {
    this.htmlContent = html;
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
    this.disposeTextTexture();
    if (this.canvas) {
      canvasPool.saveCanvas(this.canvas);
    }
    this.targetComponent = null;
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

    this.rendering = true;
    try {
      const image = await renderDOMToImage(htmlContent, contentWidth, contentHeight, contentScale);

      // 检查是否被 dispose 或版本号已变化
      if (this._disposed || startVersion !== this.renderVersion) { return; }

      if (this.targetComponent) {
        this.updateTargetTexture(image, texWidth, texHeight);
      } else {
        this.renderToTexture(texWidth, texHeight, true, ctx => {
          ctx.drawImage(image, 0, 0, texWidth, texHeight);
        });
      }
    } catch (e) {
      logger.error('DomContentComponent: Failed to render texture.', e);
    } finally {
      this.rendering = false;
      // 只在版本号未变化且需要重新渲染时才继续
      if (this.isDirty && !this._disposed && startVersion === this.renderVersion) {
        this.updateTexture().catch(e => {
          logger.error('DomContentComponent: Unhandled error in updateTexture.', e);
        });
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

    // 释放旧纹理以避免内存泄漏
    const oldTexture = target.renderer.texture;

    if (oldTexture && oldTexture !== this.engine.whiteTexture) {
      oldTexture.dispose();
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

    void target.setTexture(texture);
  }
}

applyMixins(DomContentComponent, [TextComponentBase]);
