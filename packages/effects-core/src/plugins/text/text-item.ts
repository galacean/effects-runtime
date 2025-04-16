/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import { Texture, TextureSourceType } from '../../texture';
import { TextLayout } from './text-layout';
import { TextStyle } from './text-style';
import { glContext } from '../../gl';
import { effectsClass } from '../../decorators';
import { canvasPool } from '../../canvas-pool';
import { applyMixins, isValidFontFamily } from '../../utils';
import type { Material } from '../../material';
import type { VFXItem } from '../../vfx-item';
import type { ItemRenderer } from '../../components';
import { BaseRenderComponent, getImageItemRenderInfo } from '../../components';
import { Matrix4 } from '@galacean/effects-math/es/core/index';

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
   * 段落 y 值
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

  /**
   * 每一行文本的最大宽度
   */
  protected maxLineWidth = 0;
  protected readonly SCALE_FACTOR = 0.1;
  protected readonly ALPHA_FIX_VALUE = 1 / 255;

  constructor (engine: Engine, props?: TextItemProps) {
    super(engine);

    this.name = 'MText' + seed++;
    this.geometry = this.createGeometry(glContext.TRIANGLES);

    if (props) {
      this.fromData(props);
    }

    // 初始化canvas
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
      renderer = {} as TextItemProps['renderer'];
    }

    this.interaction = interaction;

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.MESH,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ?? this.engine.emptyTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (renderer.maskMode === spec.MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: renderer.mask ?? 0,
      maskMode: renderer.maskMode ?? spec.MaskMode.NONE,
      order: listIndex,
    };
    this.interaction = interaction;
    this.cachePrefix = '-';
    this.renderInfo = getImageItemRenderInfo(this);

    const material = this.createMaterial(this.renderInfo, 2);

    this.worldMatrix = Matrix4.fromIdentity();
    this.material = material;

    // TextComponentBase 初始化
    this.updateWithOptions(options);
    this.renderText(options);

    this.setItem();
  }

  updateWithOptions (options: spec.TextContentOptions) {
    // OVERRIDE by mixins
  }

  updateTexture (flipY = true) {
    // OVERRIDE by mixins
  }

  // // 添加销毁方法
  // override dispose () {
  //   super.dispose();

  //   // 释放 ID Map 相关资源
  //   if (this.idMapTexture) {
  //     this.idMapTexture.dispose();
  //     this.idMapTexture = null;
  //   }

  //   // 释放renderer.texture资源
  //   if (this.renderer && this.renderer.texture && this.renderer.texture !== this.engine.emptyTexture) {
  //     this.renderer.texture.dispose();
  //     this.renderer.texture = this.engine.emptyTexture;
  //   }

  //   // 释放canvas资源
  //   canvasPool.saveCanvas(this.canvas);
  // }

  /**
   * 重写getMaterialProps方法，提供自定义shader
   */
  protected override getMaterialProps (renderInfo: any, count: number): any {
    // 定义一个最基础的顶点着色器
    const vertexShader = `
      precision highp float;

      attribute vec2 atlasOffset; //x y
      attribute vec3 aPos;//x y

      varying vec2 vUV;

      uniform mat4 effects_MatrixVP;
      uniform mat4 effects_ObjectToWorld;

      // #ifdef ENV_EDITOR
      // uniform vec4 uEditorTransform;
      // #endif

      void main() {
        vUV = vec2(atlasOffset.xy);

        vec4 pos = vec4(aPos.xy, aPos.z, 1.0);
        gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;


        // #ifdef ENV_EDITOR
        // gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
        // #endif
      }

    `;

    // 定义片段着色器，支持IDMap
    const fragmentShader = `
      precision highp float;

      varying vec2 vUV; //x y

      uniform sampler2D _MainTex;
      uniform sampler2D uIDMap;    // IDMap纹理

      void main() {

        vec4 color = texture2D(_MainTex, vUV.xy);
        color.rgb *= color.a; // ? TODO 预乘 alpha
        color.a = clamp(color.a, 0.0, 1.0);

        vec4 idColor = texture2D(uIDMap, vUV.xy);
        // TODO 



        gl_FragColor = vec4(idColor.rg, 1.0, 1.0);
      }

    `;

    // 返回shader配置
    return {
      shader: {
        fragment: fragmentShader,
        vertex: vertexShader,
        glslVersion: 1, // 使用数字
        macros: [],
        shared: true,
      },
    };
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
  renderer: ItemRenderer;
  /***** mix 类型兼容用 *****/

  // ID Map相关属性，使用共享的canvas
  protected idMapTexture: Texture | null = null;
  protected maxLineWidth: number;
  protected char: string[];

  protected renderText (options: spec.TextContentOptions) {
    this.updateTexture();
  }

  updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    this.text = options.text.toString();
  }

  /**
   * 生成字符 ID Map
   * 为每个字符创建唯一的颜色标识，用于后续文本动画
   */
  protected generateIDMap () {
    // 复用已有的canvas和context
    const canvas = this.canvas;
    const context = this.context;

    if (!canvas || !context) {
      return;
    }

    const { width, height } = canvas;

    // 保存当前canvas状态
    context.save();

    // 清空画布
    context.clearRect(0, 0, width, height);

    // 设置字体样式
    const fontDesc = `${this.textStyle.fontStyle} ${this.textStyle.textWeight} ${this.textStyle.fontSize}px ${this.textStyle.fontFamily}`;

    context.font = fontDesc;

    // 转换文本基线和对齐方式
    const baselineMap: Record<spec.TextBaseline, CanvasTextBaseline> = {
      [spec.TextBaseline.top]: 'top',
      [spec.TextBaseline.middle]: 'middle',
      [spec.TextBaseline.bottom]: 'bottom',
    };

    const alignMap: Record<spec.TextAlignment, CanvasTextAlign> = {
      [spec.TextAlignment.left]: 'left',
      [spec.TextAlignment.middle]: 'center',
      [spec.TextAlignment.right]: 'right',
    };

    context.textBaseline = baselineMap[this.textLayout.textBaseline];
    context.textAlign = alignMap[this.textLayout.textAlign];

    let currentX = 0;
    let currentY = 0;

    // 遍历每个字符
    for (let i = 0; i < this.text.length; i++) {
      const char = this.text[i];

      // 计算字符宽度
      const metrics = context.measureText(char);
      const charWidth = metrics.width;

      // 将字符索引转换为颜色值
      // 使用 RGB 通道，每个通道 8 位，可以支持 2^24 个字符
      const r = (i & 0xFF) / 255;
      const g = ((i >> 8) & 0xFF) / 255;
      const b = ((i >> 16) & 0xFF) / 255;

      // 设置填充颜色
      context.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;

      // 绘制字符区域
      context.fillRect(currentX, currentY, charWidth, this.textStyle.fontSize);

      // 更新位置
      currentX += charWidth + this.textLayout.letterSpace;

      // 处理换行
      if (char === '\n' || currentX > width) {
        currentX = 0;
        currentY += this.textLayout.lineHeight;
      }
    }

    // 创建 ID Map 纹理
    if (this.idMapTexture) {
      this.idMapTexture.dispose();
    }

    // 使用当前canvas创建纹理
    this.idMapTexture = Texture.create(this.engine, {
      sourceType: TextureSourceType.image,
      image: canvas,
      flipY: true,
    });

    // 将 ID Map 纹理设置到材质
    if (this.material && this.idMapTexture) {
      this.material.setTexture('uIDMap', this.idMapTexture);
      this.material.setFloat('uCharCount', this.text.length);
    }

    // 恢复canvas状态，以便于后续正常使用
    context.restore();
  }

  // 修改为protected访问级别，以便在子类中访问
  protected getLineCount (text: string, context: CanvasRenderingContext2D) {
    const { letterSpace, overflow } = this.textLayout;

    const width = (this.textLayout.width + this.textStyle.fontOffset);

    let lineCount = 1;
    let x = 0;

    for (let i = 0; i < text.length; i++) {
      const str = text[i];
      const textMetrics = context?.measureText(str)?.width ?? 0;

      // 和浏览器行为保持一致
      x += letterSpace;
      // 处理文本结束行为
      if (overflow === spec.TextOverflow.display) {
        if (str === '\n') {
          lineCount++;
          x = 0;
        } else {
          x += textMetrics;
          this.maxLineWidth = Math.max(this.maxLineWidth, x);
        }
      } else {
        if (((x + textMetrics) > width && i > 0) || str === '\n') {
          lineCount++;
          this.maxLineWidth = Math.max(this.maxLineWidth, x);
          x = 0;
        }
        if (str !== '\n') {
          x += textMetrics;
        }
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
   * 设置文本溢出模式
   *
   * - clip: 当文本内容超出边界框时，多余的会被截断。
   * - display: 该模式下会显示所有文本，会自动调整文本字号以保证显示完整。
   * > 当存在多行时，部分行内文本可能存在文本字号变小的情况，其他行为正常情况
   *
   * @param overflow - 文本溢出模式
   */
  setOverflow (overflow: spec.TextOverflow) {
    this.textLayout.overflow = overflow;
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

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    style.fontDesc = this.getFontDesc(fontSize);
    this.char = (this.text || '').split('');
    this.canvas.width = width;
    const height = this.canvas.height;

    context.font = style.fontDesc;
    this.lineCount = this.getLineCount(this.text, context);
    const finalHeight = layout.lineHeight * this.lineCount;

    if (layout.autoWidth) {
      this.canvas.height = finalHeight * fontScale;
      this.item.transform.size.set(1, finalHeight / layout.height);
    } else {
      this.canvas.height = layout.height * fontScale;
    }
    // canvas size 变化后重新刷新 context
    if (this.maxLineWidth > width && layout.overflow === spec.TextOverflow.display) {
      context.font = this.getFontDesc(fontSize * width / this.maxLineWidth);
    } else {
      context.font = style.fontDesc;
    }
    // fix bug 1/255
    context.fillStyle = 'rgba(255, 255, 255, 0.0039)';
    context.clearRect(0, 0, width, height);

    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }
    context.fillRect(0, 0, width, height);

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

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);

    this.isDirty = false;

    // 先为正常文本创建纹理，然后再生成 ID Map

    // // 保存当前图像状态
    // const savedImageData = imageData;

    // 生成 ID Map
    this.generateIDMap();

    // // 如果需要，可以恢复原始文本图像
    // if (savedImageData) {
    //   context.putImageData(savedImageData, 0, 0);
    // }
  }

  private getFontDesc (fontSize: number): string {
    const { fontFamily, textWeight, fontStyle } = this.textStyle;
    let fontDesc = `${fontSize.toString()}px `;

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
