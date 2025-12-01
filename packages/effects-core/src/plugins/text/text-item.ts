/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { Color } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { canvasPool } from '../../canvas-pool';
import type { ItemRenderer } from '../../components';
import { MaskableGraphic } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { Material } from '../../material';
import { Texture } from '../../texture';
import { applyMixins, isValidFontFamily } from '../../utils';
import type { VFXItem } from '../../vfx-item';
import { TextLayout } from './text-layout';
import { TextStyle, type FancyTextEffect, type FilterOptions } from './text-style';
import type { TextEffect } from './text-effect-base';
import { renderWithEffects } from './text-effect-base';
import { TextureEffect, EffectFactory } from './effects';
import { TextFilters, type Filter } from './text-filters';
import { CurvedTextUtils } from './curved-text-utils';

export const DEFAULT_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'courier',
];

export interface Bounds {
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
}

export interface CharInfo {
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
  /**
   * 是否为曲线文本
   */
  isCurved?: boolean,
  /**
   * 每个字符的旋转角度（弧度）
   */
  rotations?: number[],
  /**
   * 每个字符的 Y 轴偏移（用于曲线）
   */
  curvedOffsetY?: number[],
}

export interface TextComponent extends TextComponentBase { }

let seed = 0;

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.TextComponent)
export class TextComponent extends MaskableGraphic {
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

  constructor (engine: Engine, props?: spec.TextComponentData) {
    super(engine);

    this.name = 'MText' + seed++;

    if (props) {
      this.fromData(props);
    }

    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });

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

  override onDestroy (): void {
    super.onDestroy();
    this.disposeTextTexture();
  }

  override fromData (data: spec.TextComponentData): void {
    super.fromData(data);
    const { interaction, options } = data;

    this.interaction = interaction;

    // TextComponentBase
    this.updateWithOptions(options);
    this.renderText(options);

    // 恢复默认颜色
    this.material.setColor('_Color', new Color(1, 1, 1, 1));

  }

  updateWithOptions (options: spec.TextContentOptions) {
    // OVERRIDE by mixins
  }

  updateTexture (flipY = true) {
    // OVERRIDE by mixins
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

  protected maxLineWidth: number;

  private char: string[];
  private curvedTextPath: string = '';  // 存储曲线路径
  private pathLength: number = 0;       // 缓存路径长度
  private curvedTextPower: number = 0;  // 曲线强度参数

  // 文本花字特效
  effects: TextEffect[] = [];

  /**
   * 设置曲线文本路径
   * @param path SVG路径字符串，空字符串表示禁用曲线文本
   */
  setCurvedTextPath (path: string): void {
    if (this.curvedTextPath === path) {return;}
    this.curvedTextPath = path;
    this.pathLength = path ? CurvedTextUtils.calculatePathLength(path) : 0;
    this.isDirty = true;
  }

  /**
   * 设置曲线文本强度
   * @param power 曲线强度，0表示直线，>0向上弯曲，<0向下弯曲
   */
  setCurvedTextPower (power: number): void {
    if (this.curvedTextPower === power) {return;}
    this.curvedTextPower = power;

    // 确保花字配置存在
    if (!this.textStyle.fancyTextConfig) {
      this.textStyle.fancyTextConfig = {
        effects: [],
        editableParams: ['curve'],
        curvedTextPower: 0,
        curvedTextPath: '',
      };
    }

    // 同步到花字配置
    this.textStyle.fancyTextConfig.curvedTextPower = power;

    // 根据power值生成对应的SVG路径
    if (power === 0) {
      this.curvedTextPath = '';
      this.pathLength = 0;
      this.textStyle.fancyTextConfig.curvedTextPath = '';
    } else {
      // 测量文本宽度（使用缩放后的像素）
      if (this.context) {
        const fontScale = this.textStyle.fontScale;

        this.context.font = this.getFontDesc(this.textStyle.fontSize * fontScale);
        let textWidth = 0;

        for (const char of this.text || '') {
          textWidth += this.context.measureText(char).width;
        }
        // 加上字符间距（每个字符都加，与直线逻辑一致）
        const letterSpacingPx = this.textLayout.letterSpace * fontScale;

        textWidth += (this.text?.length || 0) * letterSpacingPx;

        // 生成曲线路径
        this.curvedTextPath = this.generateCurvedPath(textWidth, power);
        this.pathLength = CurvedTextUtils.calculatePathLength(this.curvedTextPath);

        // 同步路径到花字配置
        this.textStyle.fancyTextConfig.curvedTextPath = this.curvedTextPath;
      }
    }

    this.isDirty = true;
  }

  /**
   * 根据文本宽度和power值生成SVG路径
   * @param width 文本宽度
   * @param power 曲线强度
   * @returns SVG路径字符串
   */
  private generateCurvedPath (width: number, power: number): string {
    if (power === 0) {
      // 直线路径
      return `M0,0 L${width},0`;
    }

    // 控制点偏移量，根据power值调整
    const controlOffset = power * width * 0.01; // 调整系数使效果更明显

    // 三次贝塞尔曲线路径
    // M: 起点, C: 三次贝塞尔曲线
    return `M0,0 C${width / 3},${controlOffset} ${2 * width / 3},${controlOffset} ${width},0`;
  }

  // 设置文本花字特效
  setEffects (effectConfigs: FancyTextEffect[] | TextEffect[]) {
    // 判断是配置还是已创建的特效实例
    if (effectConfigs.length > 0 && 'type' in effectConfigs[0]) {
      // 是配置，需要创建特效实例
      this.effects = EffectFactory.createEffects(effectConfigs as FancyTextEffect[]);
    } else {
      // 已经是特效实例
      this.effects = effectConfigs as TextEffect[];
    }

    // 为纹理特效设置加载完成回调
    for (const effect of this.effects) {
      if (effect instanceof TextureEffect) {
        effect.setOnLoadCallback(() => {
          this.isDirty = true;
          // 触发重新渲染
          this.updateTexture();
        });
      }
    }
    this.isDirty = true;
  }

  /**
   * 设置文本滤镜
   * @param filters - 滤镜列表，可以是CSS滤镜字符串或滤镜函数
   * @param options - 滤镜参数选项
   */
  setFilters (filters: Filter[], options: FilterOptions = {}): void {
    this.textStyle.filters = filters;
    this.isDirty = true;
  }

  /**
   * 设置单个滤镜
   * @param filter - 单个滤镜
   */
  setFilter (filter: Filter): void {
    this.textStyle.filters = [filter];
    this.isDirty = true;
  }

  /**
   * 移除指定滤镜
   * @param filter - 要移除的滤镜
   */
  removeFilter (filter: Filter): void {
    this.textStyle.filters = this.textStyle.filters.filter(f => f !== filter);
    this.isDirty = true;
  }

  protected renderText (options: spec.TextContentOptions) {
    this.updateTexture();
  }

  updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    this.text = options.text.toString();
    this.lineCount = this.getLineCount(options.text, true);

    // 从 TextStyle 获取花字特效配置并创建 effects
    const config = this.textStyle.fancyTextConfig;
    const effects = EffectFactory.createEffects(config.effects);

    this.setEffects(effects);

    // 初始化滤镜（如果有的话）
    if (this.textStyle.filters && this.textStyle.filters.length > 0) {
      // 滤镜已经在 TextStyle 构造函数中设置，这里不需要额外操作
      // 因为滤镜是通过 this.textStyle.filters 直接使用的
    }
  }

  private getLineCount (text: string, init: boolean) {
    const context = this.context;
    const { letterSpace, overflow } = this.textLayout;

    // const fontScale = init ? this.textStyle.fontSize / 10 : 1 / this.textStyle.fontScale;
    this.maxLineWidth = 0;
    const width = (this.textLayout.width + this.textStyle.fontOffset);
    let lineCount = 1;
    let x = 0;

    // 设置context.font的字号，确保measureText能正确计算字宽
    if (context) {
      context.font = this.getFontDesc(this.textStyle.fontSize);
    }
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
   * 在逻辑尺寸下测量文本（直线/曲线）的包围盒
   * 坐标单位：canvas 逻辑像素（已包含 fontScale）
   */
  private measureTextBounds (
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: TextLayout,
    fontScale: number,
    layoutWidth: number,
    layoutHeight: number,
  ): Bounds {
    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    context.font = this.getFontDesc(fontSize);

    const bounds: Bounds = {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };

    const updateBounds = (x: number, y: number) => {
      if (x < bounds.minX) {bounds.minX = x;}
      if (x > bounds.maxX) {bounds.maxX = x;}
      if (y < bounds.minY) {bounds.minY = y;}
      if (y > bounds.maxY) {bounds.maxY = y;}
    };

    // 统一使用当前文本
    const chars = this.char || [];

    if (this.isCurvedTextEnabled()) {
      // ==== 曲线文本测量 ====
      const charWidths: number[] = [];
      let totalWidth = 0;

      for (const ch of chars) {
        const w = context.measureText(ch).width;

        charWidths.push(w);
        totalWidth += w;
      }

      const letterSpacing = layout.letterSpace * fontScale;
      const textWidthOnPath = totalWidth + chars.length * letterSpacing;

      // 路径上的起始 offset（按 textAlign）
      let offset = 0;

      if (layout.textAlign === spec.TextAlignment.middle) {
        offset = Math.max(0, (this.pathLength - textWidthOnPath) / 2);
      } else if (layout.textAlign === spec.TextAlignment.right) {
        offset = Math.max(0, this.pathLength - textWidthOnPath);
      }

      const baseY = layout.getOffsetY(style, 1, lineHeight, fontSize);
      const compensation = this.calculateControlPointCompensation();

      let currentPos = offset;

      for (let i = 0; i < chars.length; i++) {
        const charWidth = charWidths[i];
        const charWidthOnPath = charWidth + letterSpacing;
        const startPos = currentPos;

        if (startPos > this.pathLength) {break;}

        const startPoint = CurvedTextUtils.getPointAtLength(this.curvedTextPath, startPos);

        if (!startPoint) {break;}

        // 字符参考点坐标（与 renderCharsOnPath 中保持一致）
        const x = startPoint.x;
        const y = baseY + startPoint.y + compensation;

        // 用字高上下扩一圈，确保能捕获到弯曲后的外溢
        updateBounds(x, y - fontSize);
        updateBounds(x, y + fontSize);

        currentPos += charWidthOnPath;
      }

    } else {
      // ==== 直线文本测量 ====
      let x = 0;
      const letterSpacing = layout.letterSpace * fontScale;
      let y = layout.getOffsetY(style, this.lineCount, lineHeight, fontSize);

      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const textMetrics = context.measureText(ch);

        x += letterSpacing;

        // 换行逻辑与 updateTexture 中保持一致
        if (((x + textMetrics.width) > layoutWidth && i > 0) || ch === '\n') {
          x = 0;
          y += lineHeight;
        }

        if (ch !== '\n') {
          const charX = x;
          const charY = y;

          // 用字高上下扩一圈
          updateBounds(charX, charY - fontSize);
          updateBounds(charX, charY + fontSize);

          x += textMetrics.width;
        }
      }
    }

    // 防守型处理：无字符时避免 Infinity
    if (!isFinite(bounds.minX)) {
      bounds.minX = 0;
      bounds.maxX = 0;
      bounds.minY = 0;
      bounds.maxY = 0;
    }

    return bounds;
  }

  /**
   * 直线文本排版：根据 layoutWidth 计算换行，并在最终坐标上加 offset 补偿
   */
  private renderLinearCharsWithOffset (
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: TextLayout,
    fontScale: number,
    charsInfo: CharInfo[],
    offsetX: number,
    offsetY: number,
    layoutWidth: number,
  ): void {
    const lineHeight = layout.lineHeight * fontScale;
    const fontSize = style.fontSize * fontScale;

    let x = 0;
    let y = layout.getOffsetY(style, this.lineCount, lineHeight, fontSize);
    let charsArray: string[] = [];
    let charOffsetX: number[] = [];

    const chars = this.char || [];

    for (let i = 0; i < chars.length; i++) {
      const str = chars[i];
      const textMetrics = context.measureText(str);

      // 与原逻辑一致：每个字符前先加 letterSpace
      x += layout.letterSpace * fontScale;

      if (((x + textMetrics.width) > layoutWidth && i > 0) || str === '\n') {
        charsInfo.push({
          y: y + offsetY,
          width: x,
          chars: charsArray,
          charOffsetX: charOffsetX.map(v => v + offsetX),
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

    // 尾行
    charsInfo.push({
      y: y + offsetY,
      width: x,
      chars: charsArray,
      charOffsetX: charOffsetX.map(v => v + offsetX),
    });
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
   * 设置字体样式
   * @param value 设置字体样式
   * @default "normal"
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

    // 转换为花字配置
    this.textStyle.updateStrokeParams({ color: value, enabled: true });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
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

    // 转换为花字配置
    this.textStyle.updateStrokeParams({ width: value, enabled: true });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
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

    // 转换为花字配置
    this.textStyle.updateShadowParams({ blur: value });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
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

    // 转换为花字配置
    this.textStyle.updateShadowParams({ color: value });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 设置阴影水平偏移距离
   * @param value - 水平偏移距离
   * @returns
   */
  setShadowOffsetX (value: number): void {
    if (!this.textStyle.canEditParam('shadow')) {
      console.warn('当前预设不允许修改阴影水平偏移');

      return;
    }
    if (this.textStyle.shadowOffsetX === value) {
      return;
    }
    this.textStyle.shadowOffsetX = value;

    // 转换为花字配置
    this.textStyle.updateShadowParams({ offsetX: value });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 设置阴影垂直偏移距离
   * @param value - 垂直偏移距离
   * @returns
   */
  setShadowOffsetY (value: number): void {
    if (!this.textStyle.canEditParam('shadow')) {
      console.warn('当前预设不允许修改阴影垂直偏移');

      return;
    }
    if (this.textStyle.shadowOffsetY === value) {
      return;
    }
    this.textStyle.shadowOffsetY = value;

    // 转换为花字配置
    this.textStyle.updateShadowParams({ offsetY: value });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 设置文本颜色
   * @param value - 颜色内容
   * @returns
   */
  setTextColor (value: spec.RGBAColorValue): void {
    if (!this.textStyle.canEditParam('fill')) {
      console.warn('当前预设不允许修改文本颜色');

      return;
    }
    if (this.textStyle.textColor === value) {
      return;
    }
    this.textStyle.textColor = value;

    // 转换为花字配置
    this.textStyle.updateFillParams({ color: value });
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 设置预设特效
   * @param presetName - 预设名称
   */
  setPresetEffect (presetName: string): void {
    this.textStyle.setPresetEffect(presetName);
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 启用/禁用描边
   * @param enabled - 是否启用描边
   */
  setStrokeEnabled (enabled: boolean): void {
    this.textStyle.setStrokeEnabled(enabled);
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 启用/禁用阴影
   * @param enabled - 是否启用阴影
   */
  setShadowEnabled (enabled: boolean): void {
    this.textStyle.setShadowEnabled(enabled);
    this.effects = EffectFactory.createEffects(this.textStyle.fancyTextConfig.effects);
    this.isDirty = true;
  }

  /**
   * 获取当前花字特效配置
   */
  getCurrentFancyTextConfig () {
    return this.textStyle.getCurrentFancyTextConfig();
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
   * 更新文本纹理：支持根据文本真实包围盒扩展 canvas，并用 offset 补偿排版
   */
  updateTexture (flipY = true) {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }

    const context = this.context;
    const style = this.textStyle;
    const layout = this.textLayout;
    const fontScale = style.fontScale;

    const finalHeight = layout.lineHeight * this.lineCount;
    const fontSize = style.fontSize * fontScale;

    style.fontDesc = this.getFontDesc(fontSize);
    this.char = (this.text || '').split('');

    // 1. 逻辑排版宽高（不带扩展）
    const layoutWidth = (layout.width + style.fontOffset) * fontScale;
    const layoutHeight = (layout.autoWidth
      ? finalHeight * fontScale
      : layout.height * fontScale);

    // 2. 先在逻辑尺寸下测量文本真实包围盒
    context.font = style.fontDesc;
    const bounds = this.measureTextBounds(context, style, layout, fontScale, layoutWidth, layoutHeight);

    // 3. 计算相对逻辑画布的外溢量
    const overflowLeft = Math.max(0, -bounds.minX);
    const overflowRight = Math.max(0, bounds.maxX - layoutWidth);
    const overflowTop = Math.max(0, -bounds.minY);
    const overflowBottom = Math.max(0, bounds.maxY - layoutHeight);

    // 临时极端扩展开关：设为 true 可验证补偿机制是否起作用
    const EXTREME_TEST_MODE = false;

    let extraLeft, extraRight, extraTop, extraBottom;

    if (EXTREME_TEST_MODE) {
      // 临时：上下左右各扩 200 像素
      const extremePadding = 200;

      extraLeft = extremePadding;
      extraRight = extremePadding;
      extraTop = extremePadding;
      extraBottom = extremePadding;
    } else {
      // 正常逻辑：基于实际测量结果扩展
      const margin = 0; // 可调整成 2, 4 等安全边距

      extraLeft = overflowLeft + margin;
      extraRight = overflowRight + margin;
      extraTop = overflowTop + margin;
      extraBottom = overflowBottom + margin;
    }

    // 4. 新的 canvas 尺寸
    const canvasWidth = layoutWidth + extraLeft + extraRight;
    const canvasHeight = layoutHeight + extraTop + extraBottom;

    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    // 5. 根据扩展量计算补偿 offset（这里用「从中心扩展 + δ/2 补偿」思路）
    const deltaW = canvasWidth - layoutWidth;
    const deltaH = canvasHeight - layoutHeight;

    // 你的例子：扩高 100，下移 50 就是 offsetY = deltaH / 2
    const offsetX = deltaW / 2;
    const offsetY = deltaH / 2;

    // 如果你希望 top 对齐完全不动，可以改成：
    // const offsetX = extraLeft;
    // const offsetY = extraTop;

    // 6. transform.size：保持使用原 finalHeight，外部世界尺寸不带扩展
    if (layout.autoWidth) {
      this.item.transform.size.set(1, finalHeight / layout.height);
    }

    const height = this.canvas.height;

    // 7. 初始化 context
    context.setTransform(1, 0, 0, 1, 0, 0);
    // fix bug 1/255
    context.fillStyle = 'rgba(255, 255, 255, 0.0039)';

    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // canvas size 变化后重新刷新字体
    if (this.maxLineWidth > layoutWidth && layout.overflow === spec.TextOverflow.display) {
      context.font = this.getFontDesc(fontSize * layoutWidth / this.maxLineWidth);
    } else {
      context.font = style.fontDesc;
    }

    // 统一使用花字渲染系统
    context.shadowColor = 'transparent';
    context.lineJoin = 'round';

    // 文本颜色只是占位色，真正颜色由效果系统控制
    context.fillStyle = `rgba(${style.textColor[0]}, ${style.textColor[1]}, ${style.textColor[2]}, ${style.textColor[3]})`;

    context.fillStyle = 'rgba(255, 0, 0, 1)';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    const charsInfo: CharInfo[] = [];

    // 8. 用 offset 补偿排版
    if (this.isCurvedTextEnabled()) {
      this.renderCharsOnPathWithOffset(context, style, layout, fontScale, charsInfo, offsetX, offsetY);
    } else {
      this.renderLinearCharsWithOffset(context, style, layout, fontScale, charsInfo, offsetX, offsetY, layoutWidth);
    }

    // 9. 使用花字渲染系统
    renderWithEffects(
      this.canvas,
      context,
      style,
      layout,
      charsInfo,
      this.effects
    );

    if (style.hasShadow) {
      context.shadowColor = 'transparent';
    }

    // 10. 应用滤镜
    let finalCanvas = this.canvas;

    if (this.textStyle.filters && this.textStyle.filters.length > 0) {
      finalCanvas = TextFilters.applyFilters(this.canvas, this.textStyle.filters);
    }

    // 11. 生成纹理
    const finalContext = finalCanvas.getContext('2d')!;
    const imageData = finalContext.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
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

    this.disposeTextTexture();

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);

    // 关键：同步更新几何体尺寸，确保扩展后的canvas不被裁剪
    const scaleX = canvasWidth / layoutWidth;
    const scaleY = canvasHeight / layoutHeight;

    // 更新transform.size以匹配扩展后的canvas
    if (layout.autoWidth) {
      this.item.transform.size.set(scaleX, scaleY * finalHeight / layout.height);
    } else {
      this.item.transform.size.set(scaleX, scaleY);
    }

    this.isDirty = false;
  }

  /**
   * 判断是否启用曲线文本
   * @returns 是否启用曲线文本
   */
  private isCurvedTextEnabled (): boolean {
    return (this.curvedTextPower !== 0 || !!this.curvedTextPath) && this.pathLength > 0 && !!this.context;
  }

  /**
   * 基于控制点直接计算补偿（针对自动生成的曲线路径）
   * @returns Y轴补偿值
   */
  private calculateControlPointCompensation (): number {
    // 只对自动生成的曲线路径有效（通过setCurvedTextPower设置的）
    if (this.curvedTextPower === 0) {
      return 0;
    }

    // 获取文本宽度
    const fontScale = this.textStyle.fontScale;
    let textWidth = 0;

    if (this.context) {
      this.context.font = this.getFontDesc(this.textStyle.fontSize * fontScale);
      for (const char of this.char || '') {
        textWidth += this.context.measureText(char).width;
      }
      const letterSpacingPx = this.textLayout.letterSpace * fontScale;

      textWidth += (this.char?.length || 0) * letterSpacingPx;
    }

    if (textWidth <= 0) {
      return 0;
    }

    // 计算控制点偏移量
    // 这与 generateCurvedPath 中的计算保持一致
    const controlOffset = this.curvedTextPower * textWidth * 0.01;

    // 对于对称的贝塞尔曲线，中点的Y坐标是控制点Y坐标的 0.75 倍
    // 但我们希望文本保持在基线位置（Y=0），所以需要补偿这个偏移
    const midpointOffset = controlOffset * 0.75;

    // 补偿值是中点偏移的相反数
    return -midpointOffset;
  }

  /**
   * 曲线文本排版：在路径上排字符，并在最终坐标上加 offset 补偿
   */
  private renderCharsOnPathWithOffset (
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: TextLayout,
    fontScale: number,
    charsInfo: CharInfo[],
    offsetX: number,
    offsetY: number,
  ): void {
    // 测量字符宽度
    const charWidths: number[] = [];
    let totalWidth = 0;
    const chars = this.char || [];

    for (const char of chars) {
      const width = context.measureText(char).width;

      charWidths.push(width);
      totalWidth += width;
    }

    // 计算字符间距（与直线逻辑一致：每个字符都加）
    const letterSpacing = layout.letterSpace * fontScale;
    const textWidthOnPath = totalWidth + chars.length * letterSpacing;

    // 计算路径上的起始 offset
    let offset = 0;

    if (layout.textAlign === spec.TextAlignment.middle) {
      offset = Math.max(0, (this.pathLength - textWidthOnPath) / 2);
    } else if (layout.textAlign === spec.TextAlignment.right) {
      offset = Math.max(0, this.pathLength - textWidthOnPath);
    }

    // 清空原有的 charsInfo 由调用方控制，这里不再清空
    // charsInfo.length = 0;

    // 计算贝塞尔控制点补偿
    const compensation = this.calculateControlPointCompensation();

    // 构建路径字符信息
    let currentPos = offset;
    const charsArray: string[] = [];
    const charOffsetX: number[] = [];
    const rotations: number[] = [];
    const curvedOffsetY: number[] = [];
    const y = layout.getOffsetY(style, 1, layout.lineHeight * fontScale, style.fontSize * fontScale);

    for (let i = 0; i < chars.length; i++) {
      const charWidth = charWidths[i];
      const charWidthOnPath = charWidth + letterSpacing;

      const startPos = currentPos;

      if (startPos > this.pathLength) {break;}

      const startPoint = CurvedTextUtils.getPointAtLength(this.curvedTextPath, startPos);

      if (!startPoint) {break;}

      const anglePoint = CurvedTextUtils.getPointAtLength(this.curvedTextPath, startPos + charWidth / 2) || startPoint;

      charsArray.push(chars[i]);
      // 这里是路径上的 x，再加 offsetX 由最终 push 处理
      charOffsetX.push(startPoint.x);
      rotations.push(anglePoint.angle);
      curvedOffsetY.push(startPoint.y + compensation);

      currentPos += charWidthOnPath;
    }

    if (charsArray.length > 0) {
      charsInfo.push({
        y: y + offsetY,
        width: textWidthOnPath,
        chars: charsArray,
        charOffsetX: charOffsetX.map(v => v + offsetX),
        isCurved: true,
        rotations,
        curvedOffsetY,
      });
    }
  }

  protected disposeTextTexture () {
    const texture = this.renderer.texture;

    if (texture && texture !== this.engine.whiteTexture) {
      texture.dispose();
    }
  }

  private getFontDesc (size?: number): string {
    const { fontSize, fontScale, fontFamily, textWeight, fontStyle } = this.textStyle;
    let fontDesc = `${(size || fontSize * fontScale).toString()}px `;

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

}

applyMixins(TextComponent, [TextComponentBase]);
