/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { Engine } from '@galacean/effects';
import {
  MaskableGraphic, effectsClass, math, logger, applyMixins, TextComponentBase,
} from '@galacean/effects';
import { renderDOMToImage } from './dom-to-texture';

const DATA_TYPE = 'DomContentComponent';

/** 单边纹理最大像素数，超过此值会被 clamp */
const MAX_TEXTURE_SIZE = 2048;

let seed = 0;

/** 接口声明合并，混入 TextComponentBase */
export interface DomContentComponent extends TextComponentBase { }

/**
 * DOM 内容组件
 * 将 HTML/CSS 渲染为纹理，通过 mixin 复用 TextComponentBase 的 canvas 管理和纹理绘制能力
 */
@effectsClass(DATA_TYPE)
export class DomContentComponent extends MaskableGraphic {
  /** HTML 内容字符串 */
  htmlContent = '';
  /** 渲染宽度（CSS 像素） */
  contentWidth = 300;
  /** 渲染高度（CSS 像素） */
  contentHeight = 200;
  /** 缩放倍率，用于高清屏适配，默认为 1 */
  contentScale = 1;

  // TextComponentBase 混入属性
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  isDirty: boolean;

  /** 是否正在异步渲染中，防止重复触发 */
  private rendering = false;
  /** 组件销毁标记，用于异步回调中的安全检查 */
  private _disposed = false;

  /** mixin 的 ALPHA_FIX_VALUE 是实例属性，需在子类中重新声明 */
  protected readonly ALPHA_FIX_VALUE = 1 / 255;

  constructor (engine: Engine) {
    super(engine);
    this.name = 'MDomContent' + seed++;
    this.isDirty = false;
    this.initTextBase(engine);
  }

  /**
   * 设置 HTML 内容并触发重新渲染
   * @param html - HTML 字符串（CSS 需内联，图片需 base64）
   * @param width - 渲染宽度（CSS 像素）
   * @param height - 渲染高度（CSS 像素）
   * @param scale - 缩放倍率，用于高清屏适配，默认为 1
   */
  setContent (html: string, width?: number, height?: number, scale?: number): void {
    this.htmlContent = html;
    if (width !== undefined) { this.contentWidth = width; }
    if (height !== undefined) { this.contentHeight = height; }
    if (scale !== undefined) { this.contentScale = Math.max(0, scale); }
    this.isDirty = true;
  }

  override onAwake (): void {
    this.material.setColor('_Color', new math.Color(1, 1, 1, 1));
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    if (this.isDirty && !this.rendering) {
      this.isDirty = false;
      void this.updateTexture();
    }
  }

  override onDestroy (): void {
    super.onDestroy();
    this._disposed = true;
    this.disposeTextTexture();
  }

  /**
   * 异步将 HTML 渲染为纹理并更新材质
   */
  private async updateTexture (): Promise<void> {
    const { htmlContent, contentWidth, contentHeight, contentScale } = this;

    if (!htmlContent || contentWidth <= 0 || contentHeight <= 0) {
      return;
    }

    const texWidth = Math.min(Math.round(contentWidth * contentScale), MAX_TEXTURE_SIZE);
    const texHeight = Math.min(Math.round(contentHeight * contentScale), MAX_TEXTURE_SIZE);

    if (texWidth <= 0 || texHeight <= 0) {
      return;
    }

    this.rendering = true;
    try {
      const image = await renderDOMToImage(htmlContent, contentWidth, contentHeight, contentScale);

      // 组件可能在异步期间被销毁
      if (this._disposed) { return; }

      this.renderToTexture(texWidth, texHeight, true, ctx => {
        ctx.drawImage(image, 0, 0, texWidth, texHeight);
      });
    } catch (e) {
      logger.error('DomContentComponent: Failed to render texture.', e);
      this.isDirty = false;
    } finally {
      this.rendering = false;
      if (this.isDirty && !this._disposed) {
        void this.updateTexture();
      }
    }
  }
}

applyMixins(DomContentComponent, [TextComponentBase]);
