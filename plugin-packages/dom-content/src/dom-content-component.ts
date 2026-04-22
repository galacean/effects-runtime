/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { Engine, Renderer } from '@galacean/effects';
import {
  MaskableGraphic, effectsClass, math, logger, applyMixins, TextComponentBase, Texture, glContext,
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

  constructor (engine: Engine) {
    super(engine);
    this.isDirty = false;
    this.initTextBase(engine);
  }

  setContent (html: string, width?: number, height?: number, scale?: number): void {
    this.htmlContent = html;
    if (width !== undefined) { this.contentWidth = width; }
    if (height !== undefined) { this.contentHeight = height; }
    if (scale !== undefined) { this.contentScale = Math.max(0, scale); }
    this.isDirty = true;
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
      void this.updateTexture();
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
    this.targetComponent = null;
  }

  private async updateTexture (): Promise<void> {
    const { htmlContent, contentWidth, contentHeight, contentScale } = this;

    if (!htmlContent || contentWidth <= 0 || contentHeight <= 0) { return; }

    const texWidth = Math.min(Math.round(contentWidth * contentScale), MAX_TEXTURE_SIZE);
    const texHeight = Math.min(Math.round(contentHeight * contentScale), MAX_TEXTURE_SIZE);

    if (texWidth <= 0 || texHeight <= 0) { return; }

    this.rendering = true;
    try {
      const image = await renderDOMToImage(htmlContent, contentWidth, contentHeight, contentScale);

      if (this._disposed) { return; }

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
      if (this.isDirty && !this._disposed) {
        void this.updateTexture();
      }
    }
  }

  private updateTargetTexture (image: HTMLImageElement, width: number, height: number): void {
    if (!this.canvas || !this.context) { return; }

    const ctx = this.context;

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

    void this.targetComponent!.setTexture(texture);
  }
}

applyMixins(DomContentComponent, [TextComponentBase]);
