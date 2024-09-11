/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import { Texture } from '../../texture';
import { TextLayout } from './text-layout';
import { TextStyle } from './text-style';
import { glContext } from '../../gl';
import { effectsClass } from '../../decorators';
import { canvasPool } from '../../canvas-pool';
import { applyMixins, isValidFontFamily } from '../../utils';
import type { Material } from '../../material';
import type { VFXItem } from '../../vfx-item';
import { BaseRenderComponent } from '../../components/base-render-component';
import type { ColorPlayableAssetData } from '../../animation';
import { ColorPlayable } from '../../animation';
import type { Playable, PlayableGraph } from '../cal/playable-graph';
import { PlayableAsset } from '../cal/playable-graph';

/**
 * 用于创建 textItem 的数据类型, 经过处理后的 spec.TextContentOptions
 */
export interface TextItemProps extends Omit<spec.TextContent, 'renderer'> {
  listIndex?: number,
  renderer: {
    mask: number,
    texture: Texture,
  } & Omit<spec.RendererOptions, 'texture'>,
}

export const DEFAULT_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'courier',
];

interface CharInfo {
  /**
   * 段落y值
   */
  y: number,
  /**
   * 段落字符
   */
  chars: string[],
  charOffsetX: number[],
  /**
   * 段落宽度
   */
  width: number,
}

export interface TextComponent extends TextComponentBase { }
let seed = 0;

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.TextComponent)
export class TextComponent extends BaseRenderComponent {
  isDirty = true;

  /**
   * 文本行数
   */
  lineCount = 0;

  constructor (engine: Engine, props?: TextItemProps) {
    super(engine);
    this.name = 'MText' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);
    if (props) {
      this.fromData(props);
    }

    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.setItem();

    if (!props) {
      return;
    }

    const { options } = props;

    this.updateWithOptions(options);
    this.updateTexture();
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    this.updateTexture();
  }

  override fromData (data: TextItemProps): void {
    super.fromData(data);
    const { interaction, options, listIndex = 0 } = data;
    let renderer = data.renderer;

    if (!renderer) {
      //@ts-expect-error
      renderer = {};
    }

    this.interaction = interaction;

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.BILLBOARD,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!(renderer.occlusion),
      transparentOcclusion: !!(renderer.transparentOcclusion) || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };

    this.interaction = interaction;
    this.updateWithOptions(options);
    // Text
    this.updateTexture();
  }

  updateWithOptions (options: spec.TextContentOptions) {
    // OVERRIDE by mixins
  }

  updateTexture (flipY = true) {
    // OVERRIDE by mixins
  }
}

@effectsClass('TextColorPlayableAsset')
export class TextColorPlayableAsset extends PlayableAsset {
  data: ColorPlayableAssetData;

  override createPlayable (graph: PlayableGraph): Playable {
    const textColorPlayable = new ColorPlayable(graph);

    textColorPlayable.create(this.data);

    return textColorPlayable;
  }

  override fromData (data: ColorPlayableAssetData): void {
    this.data = data;
  }
}

export class TextComponentBase {
  textStyle: TextStyle;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: TextLayout;
  text: string;

  /***** mix 类型兼容用 *****/
  isDirty: boolean;
  engine: Engine;
  material: Material;
  lineCount: number;
  item: VFXItem;
  /***** mix 类型兼容用 *****/

  private char: string[];

  updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    this.text = options.text.toString();
    this.lineCount = this.getLineCount(options.text, true);
  }

  private getLineCount (text: string, init: boolean) {
    const context = this.context;
    const letterSpace = this.textLayout.letterSpace;
    const fontScale = init ? this.textStyle.fontSize / 10 : 1 / this.textStyle.fontScale;
    const width = (this.textLayout.width + this.textStyle.fontOffset);
    let lineCount = 1;
    let x = 0;

    for (let i = 0; i < text.length; i++) {
      const str = text[i];
      const textMetrics = (context?.measureText(str)?.width ?? 0) * fontScale;

      // 和浏览器行为保持一致
      x += letterSpace;

      if (((x + textMetrics) > width && i > 0) || str === '\n') {
        lineCount++;
        x = 0;
      }
      if (str !== '\n') {
        x += textMetrics;
      }
    }

    return lineCount;
  }

  /**
   * 设置字号大小
   * @param value - 字号
   * @returns
   */
  setFontSize (value: number): void {
    if (this.textStyle.fontSize === value) {
      return;
    }
    // 保证字号变化后位置正常
    const diff = this.textStyle.fontSize - value;

    this.textLayout.lineHeight += diff;
    this.textStyle.fontSize = value;

    this.isDirty = true;
  }

  /**
   * 设置字重
   * @param value - 字重类型
   * @returns
   */
  setFontWeight (value: spec.TextWeight): void {
    if (this.textStyle.textWeight === value) {
      return;
    }
    this.textStyle.textWeight = value;
    this.isDirty = true;
  }

  /**
   * 设置字体类型
   * @param value 字体类型
   * @returns
   */
  setFontStyle (value: spec.FontStyle): void {
    if (this.textStyle.fontStyle === value) {
      return;
    }
    this.textStyle.fontStyle = value;
    this.isDirty = true;
  }

  /**
   * 设置文本
   * @param value - 文本内容
   * @returns
   */
  setText (value: string): void {
    if (this.text === value) {
      return;
    }
    this.text = value.toString();
    this.lineCount = this.getLineCount(value, false);
    this.isDirty = true;
  }

  /**
   * 设置文本水平布局
   * @param value - 布局选项
   * @returns
   */
  setTextAlign (value: spec.TextAlignment): void {
    if (this.textLayout.textAlign === value) {
      return;
    }
    this.textLayout.textAlign = value;
    this.isDirty = true;
  }

  /**
   * 设置文本垂直布局
   * @param value - 布局选项
   * @returns
   */
  setTextBaseline (value: spec.TextBaseline): void {
    if (this.textLayout.textBaseline === value) {
      return;
    }
    this.textLayout.textBaseline = value;
    this.isDirty = true;
  }

  /**
   * 设置文本颜色
   * @param value - 颜色内容
   * @returns
   */
  setTextColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.textColor === value) {
      return;
    }
    this.textStyle.textColor = value;
    this.isDirty = true;
  }

  /**
   * 设置文本字体
   * @param value - 文本字体
   * @returns
   */
  setFontFamily (value: string): void {
    if (this.textStyle.fontFamily === value && !isValidFontFamily(value)) {
      console.warn('The font is either the current font or an risky font family.');

      return;
    }
    this.textStyle.fontFamily = value;
    this.isDirty = true;
  }

  /**
   * 设置外描边文本颜色
   * @param value - 颜色内容
   * @returns
   */
  setOutlineColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.outlineColor === value) {
      return;
    }
    this.textStyle.outlineColor = value;
    this.isDirty = true;
  }

  /**
   * 设置外描边文本宽度
   * @param value - 外描边宽度
   * @returns
   */
  setOutlineWidth (value: number): void {
    if (this.textStyle.outlineWidth === value) {
      return;
    }
    this.textStyle.outlineWidth = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影模糊
   * @param value - 阴影模糊强度
   * @returns
   */
  setShadowBlur (value: number): void {
    if (this.textStyle.shadowBlur === value) {
      return;
    }
    this.textStyle.shadowBlur = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影颜色
   * @param value - 阴影颜色
   * @returns
   */
  setShadowColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.shadowColor === value) {
      return;
    }
    this.textStyle.shadowColor = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影水平偏移距离
   * @param value - 水平偏移距离
   * @returns
   */
  setShadowOffsetX (value: number): void {
    if (this.textStyle.shadowOffsetX === value) {
      return;
    }
    this.textStyle.shadowOffsetX = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影水平偏移距离
   * @param value - 水平偏移距离
   * @returns
   */
  setShadowOffsetY (value: number): void {
    if (this.textStyle.shadowOffsetY === value) {
      return;
    }
    this.textStyle.shadowOffsetY = value;
    this.isDirty = true;
  }

  /**
   * 设置字体清晰度
   * @param value - 字体清晰度
   * @returns
   */
  setFontScale (value: number): void {
    if (this.textStyle.fontScale === value) {
      return;
    }

    this.textStyle.fontScale = value;
    this.isDirty = true;
  }

  /**
   * 设置自适应宽高开关
   * @param value - 是否自适应宽高开关
   * @returns
   */
  setAutoWidth (value: boolean): void {
    if (this.textLayout.autoWidth === value) {
      return;
    }

    this.textLayout.autoWidth = value;
    this.isDirty = true;
  }

  /**
   * 更新文本
   * @returns
   */
  updateTexture (flipY = true) {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }
    const context = this.context;
    const style = this.textStyle;
    const layout = this.textLayout;
    const fontScale = style.fontScale;

    const width = (layout.width + style.fontOffset) * fontScale;
    const finalHeight = layout.lineHeight * this.lineCount;

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    this.char = (this.text || '').split('');
    this.canvas.width = width;

    if (layout.autoWidth) {
      this.canvas.height = finalHeight * fontScale;
      this.item.transform.size.set(1, finalHeight / layout.height);
    } else {
      this.canvas.height = layout.height * fontScale;
    }

    const height = this.canvas.height;

    context.clearRect(0, 0, width, height);
    // fix bug 1/255
    context.fillStyle = 'rgba(255, 255, 255, 0.0039)';

    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    context.fillRect(0, 0, width, height);
    style.fontDesc = this.getFontDesc();
    context.font = style.fontDesc;

    if (style.hasShadow) {
      this.setupShadow();
    }

    if (style.isOutlined) {
      this.setupOutline();
    }

    // 文本颜色
    context.fillStyle = `rgba(${style.textColor[0]}, ${style.textColor[1]}, ${style.textColor[2]}, ${style.textColor[3]})`;

    const charsInfo: CharInfo[] = [];

    let x = 0;
    let y = layout.getOffsetY(style, this.lineCount, lineHeight, fontSize);
    let charsArray = [];
    let charOffsetX = [];

    for (let i = 0; i < this.char.length; i++) {
      const str = this.char[i];
      const textMetrics = context.measureText(str);

      // 和浏览器行为保持一致
      x += layout.letterSpace * fontScale;

      if (((x + textMetrics.width) > width && i > 0) || str === '\n') {
        charsInfo.push({
          y,
          width: x,
          chars: charsArray,
          charOffsetX,
        });
        x = 0;
        y += lineHeight;
        charsArray = [];
        charOffsetX = [];
      }

      if (str !== '\n') {
        charsArray.push(str);
        charOffsetX.push(x);

        x += textMetrics.width;
      }
    }
    charsInfo.push({
      y,
      width: x,
      chars: charsArray,
      charOffsetX,
    });

    charsInfo.forEach(charInfo => {
      const x = layout.getOffsetX(style, charInfo.width);

      charInfo.chars.forEach((str, i) => {
        if (style.isOutlined) {
          context.strokeText(str, x + charInfo.charOffsetX[i], charInfo.y);
        }

        context.fillText(str, x + charInfo.charOffsetX[i], charInfo.y);
      });
    });

    if (style.hasShadow) {
      context.shadowColor = 'transparent';
    }

    //与 toDataURL() 两种方式都需要像素读取操作
    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);

    this.material.setTexture('uSampler0',
      Texture.createWithData(
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
      ),
    );

    this.isDirty = false;
  }

  private getFontDesc (): string {
    const { fontSize, fontScale, fontFamily, textWeight, fontStyle } = this.textStyle;
    let fontDesc = `${(fontSize * fontScale).toString()}px `;

    if (!DEFAULT_FONTS.includes(fontFamily)) {
      fontDesc += `"${fontFamily}"`;
    } else {
      fontDesc += fontFamily;
    }
    if (textWeight !== spec.TextWeight.normal) {
      fontDesc = `${textWeight} ${fontDesc}`;
    }

    if (fontStyle !== spec.FontStyle.normal) {
      fontDesc = `${fontStyle} ${fontDesc}`;
    }

    return fontDesc;
  }

  private setupOutline (): void {
    const context = this.context;
    const { outlineColor, outlineWidth } = this.textStyle;
    const [r, g, b, a] = outlineColor;

    if (context) {
      context.strokeStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      context.lineWidth = outlineWidth * 2;
    }
  }

  private setupShadow (): void {
    const context = this.context;
    const { outlineColor, shadowBlur, shadowOffsetX, shadowOffsetY } = this.textStyle;
    const [r, g, b, a] = outlineColor;

    if (context) {
      context.shadowColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      context.shadowBlur = shadowBlur;
      context.shadowOffsetX = shadowOffsetX;
      context.shadowOffsetY = -shadowOffsetY;
    }
  }
}

applyMixins(TextComponent, [TextComponentBase]);
