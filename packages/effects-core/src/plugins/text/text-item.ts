import * as spec from '@galacean/effects-specification';
import { Texture } from '../../texture';
import { TextMesh } from './text-mesh';
import type { TextVFXItem } from './text-vfx-item';
import type { SpriteItemProps } from '../sprite/sprite-item';
import { SpriteItem } from '../sprite/sprite-item';
import type { SpriteMesh } from '../sprite/sprite-mesh';
import { TextStyle } from './text-style';
import { DEFAULT_FONTS, canvasPool } from '../../template-image';
import { TextLayout } from './text-layout';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { SpriteVFXItem } from '../sprite/sprite-vfx-item';

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

export class TextItem extends SpriteItem {

  textStyle: TextStyle;
  isDirty = true;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: TextLayout;
  text: string;
  private engine: Engine;
  private char: string[];

  constructor (
    props: spec.TextContent,
    opts: {
      emptyTexture: Texture,
    },
    vfxItem: TextVFXItem,
  ) {
    super(props as unknown as SpriteItemProps, opts, vfxItem as unknown as SpriteVFXItem);
    const { options } = props;

    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });

    this.engine = vfxItem.composition.getEngine();

    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);

    this.text = options.text;

    // Text
    this.mesh = new TextMesh(this.engine, this.renderInfo, vfxItem.composition) as unknown as SpriteMesh;
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
    this.textStyle.fontSize = value;
    // 1.5175 = 31.43 / 20
    this.textLayout.lineHeight = this.textStyle.fontSize * 1.5175;

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
    this.text = value;
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
    if (this.textStyle.fontFamily === value) {
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
   * 更新文本
   * @returns
   */
  updateTexture () {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }
    const context = this.context;
    const style = this.textStyle;
    const layout = this.textLayout;
    const fontScale = style.fontScale;

    const width = (layout.width + style.fontOffset) * fontScale;
    const height = layout.height * fontScale;

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    this.char = (this.text || '').split('');

    this.canvas.width = width ;
    this.canvas.height = height;

    context.clearRect(0, 0, width, this.canvas.height);
    // fix bug 1/255
    context.fillStyle = 'rgba(255, 255, 255, 0.0039)';

    context.fillRect(0, 0, width, this.canvas.height);
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
    // /3 为了和编辑器行为保持一致
    const offsetY = (lineHeight - fontSize) / 3;

    let x = 0;
    let y = layout.getOffsetY(style) + offsetY;
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

    charsInfo.forEach(charInfo=>{
      const x = layout.getOffsetX(style, charInfo.width);

      charInfo.chars.forEach((str, i)=>{
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

    this.mesh?.mesh.material.setTexture('uSampler0', Texture.createWithData(this.engine,
      {
        data: new Uint8Array(imageData.data),
        width: imageData.width,
        height: imageData.height,
      },
      {
        flipY:true,
        magFilter: glContext.LINEAR,
        minFilter: glContext.LINEAR,
        wrapS: glContext.CLAMP_TO_EDGE,
        wrapT: glContext.CLAMP_TO_EDGE,
      }
    ));

    this.isDirty = false;
  }

  private getFontDesc (): string {
    const textStyle = this.textStyle;
    let fontDesc = `${(textStyle.fontSize * textStyle.fontScale).toString()}px `;

    if (!DEFAULT_FONTS.includes(textStyle.fontFamily)) {
      fontDesc += `"${textStyle.fontFamily}"`;
    } else {
      fontDesc += textStyle.fontFamily;
    }

    if (textStyle.textWeight !== spec.TextWeight.normal) {
      fontDesc = `${textStyle.textWeight} ${fontDesc}`;
    }

    if (textStyle.fontStyle !== spec.FontStyle.normal) {
      fontDesc = `${textStyle.fontStyle} ${fontDesc}`;
    }

    return fontDesc;
  }

  private setupOutline (): void {
    const context = this.context;
    const style = this.textStyle;

    context!.strokeStyle = `rgba(${style.outlineColor[0] * 255}, ${style.outlineColor[1] * 255}, ${style.outlineColor[2] * 255}, ${style.outlineColor[3]})`;
    context!.lineWidth = style.outlineWidth * 2;

  }

  private setupShadow (): void {
    const context = this.context;
    const style = this.textStyle;

    context!.shadowColor = `rgba(${style.shadowColor[0] * 255}, ${style.shadowColor[1] * 255}, ${style.shadowColor[2] * 255}, ${style.shadowColor[3]})`;
    context!.shadowBlur = style.shadowBlur ;
    context!.shadowOffsetX = style.shadowOffsetX ;
    context!.shadowOffsetY = -style.shadowOffsetY ;
  }
}
