import * as spec from '@galacean/effects-specification';
import type { FancyTextStyle, FancyTextEffect } from './fancy-types';

function normalizeColor (rgba: number[]): [number, number, number, number] {
  if (!rgba || rgba.length < 3) {return [1, 1, 1, 1];}
  const [r, g, b, a = 1] = rgba;

  if (r > 1 || g > 1 || b > 1) {
    return [r / 255, g / 255, b / 255, a];
  }

  return [r, g, b, a];
}

/**
 * ========= 前端 JSON 模拟结构：开始 =========
 */

/** 整体花字配置 JSON：只是一个效果栈 */
export interface FancyConfigJSON {
  effects: FancyEffectJSON[],
}

/** 单个效果层 JSON，与核心基础 type 对应 */
export type FancyEffectJSON =
  | SolidFillJSON
  | SingleStrokeJSON
  | GradientJSON
  | ShadowJSON
  | TextureJSON;

export interface SolidFillJSON {
  type: 'solid-fill',
  color: number[],              // [r,g,b,a]，0-1 或 0-255
}

export interface SingleStrokeJSON {
  type: 'single-stroke',
  width: number,
  color: number[],
  unit?: 'px' | 'em',
}

export interface GradientJSON {
  type: 'gradient',
  colors: number[][],           // 多个渐变颜色
  angle?: number,               // 角度（度），0=水平，90=垂直
}

export interface ShadowJSON {
  type: 'shadow',
  color?: number[],
  blur?: number,
  offsetX?: number,
  offsetY?: number,
}

export interface TextureJSON {
  type: 'texture',
  imageUrl: string,             // 纹理图片 URL，pattern 运行时再填
}

/**
 * 一个模拟 JSON 示例：多描边 + 填充
 * 可以在 demo 或测试中直接用 TextStyle.parseFancyConfigJSON(MULTI_STROKE_SAMPLE)
 */
export const MULTI_STROKE_SAMPLE: FancyConfigJSON = {
  effects: [
    { type: 'single-stroke', width: 15, color: [0.75, 0.28, 0.77, 1] },
    { type: 'single-stroke', width: 12, color: [0.44, 0.34, 0.81, 1] },
    { type: 'single-stroke', width: 9, color: [0.52, 0.89, 0.19, 1] },
    { type: 'single-stroke', width: 6, color: [1, 0.52, 0.36, 1] },
    { type: 'single-stroke', width: 3, color: [0.99, 0.19, 0.51, 1] },
    { type: 'solid-fill', color: [1, 1, 1, 1] },
  ],
};

/**
 * 一个模拟 JSON 示例：阴影 + 描边 + 渐变填充
 */
export const GRADIENT_WITH_STROKE_SAMPLE: FancyConfigJSON = {
  effects: [
    {
      type: 'shadow',
      color: [0, 0, 0, 0.6],
      blur: 8,
      offsetX: 4,
      offsetY: 4,
    },
    {
      type: 'single-stroke',
      width: 3,
      color: [0, 0, 0, 1],
    },
    {
      type: 'gradient',
      colors: [
        [1, 0, 0, 1],
        [0, 0, 1, 1],
      ],
      angle: 0,
    },
  ],
};

/**
 * ========= 前端 JSON 模拟结构：结束 =========
 */

export class TextStyle {
  /**
   * 字重
   */
  textWeight: spec.TextWeight;
  /**
   * 字体样式
   */
  fontStyle: spec.FontStyle;
  /**
   * 是否有下划线（暂时无效）
   */
  isUnderline = false;
  /**
   * 下划线高度（暂时无效）
   */
  underlineHeight = 1;
  /**
   * 是否有外描边
   */
  isOutlined = false;
  /**
   * 外描边颜色
   */
  outlineColor: spec.vec4;
  /**
   * 外描边宽度
   */
  outlineWidth = 0;
  /**
   * 是否有阴影
   */
  hasShadow = false;
  /**
   * 阴影颜色
   */
  shadowColor: spec.vec4;
  /**
   * 阴影模糊
   */
  shadowBlur: number;
  /**
   * 阴影水平偏移距离
   */
  shadowOffsetX: number;
  /**
   * 阴影高度偏移距离
   */
  shadowOffsetY: number;

  /**
   * 文本颜色
   */
  textColor: spec.vec4;

  /**
   * 字体大小
   */
  fontSize: number;

  fontFamily: string;
  fontDesc = '';

  /**
   * 字体倍数
   */
  fontScale = 2;

  fontOffset = 0;

  /**
   * 花字配置
   */
  fancyTextConfig: FancyTextStyle;

  constructor (options: spec.TextContentOptions) {
    this.update(options);
  }

  update (options: spec.TextContentOptions): void {
    const {
      textColor = [1, 1, 1, 1],
      fontSize = 40,
      outline,
      shadow,
      fontWeight = 'normal',
      fontStyle = 'normal',
      fontFamily = 'sans-serif',
      // 模拟：options 可能带 fancyConfigJSON
      // @ts-expect-error
      fancyConfigJSON = MULTI_STROKE_SAMPLE,
    } = options;

    this.textColor = normalizeColor([...textColor]);
    //@ts-expect-error
    this.textWeight = fontWeight;
    //@ts-expect-error
    this.fontStyle = fontStyle;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;

    // 重置描边状态
    this.isOutlined = false;
    this.outlineColor = [1, 1, 1, 1];
    this.outlineWidth = 0;

    if (outline) {
      this.isOutlined = true;
      this.outlineColor = normalizeColor([...(outline.outlineColor ?? [1, 1, 1, 1])]);
      this.outlineWidth = outline.outlineWidth ?? 1;
    }

    // 重置阴影状态
    this.hasShadow = false;
    this.shadowBlur = 2;
    this.shadowColor = [0, 0, 0, 1];
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;

    if (shadow) {
      this.hasShadow = true;
      this.shadowBlur = shadow.shadowBlur ?? 2;
      this.shadowColor = normalizeColor([...(shadow.shadowColor ?? [0, 0, 0, 1])]);
      this.shadowOffsetX = shadow.shadowOffsetX ?? 0;
      this.shadowOffsetY = shadow.shadowOffsetY ?? 0;
    }

    // 重置字体偏移
    this.fontOffset = 0;
    if (this.fontStyle !== spec.FontStyle.normal) {
      // 0.0174532925 = 3.141592653 / 180
      this.fontOffset += this.fontSize * Math.tan(12 * 0.0174532925);
    }

    // 关键：初始化花字配置
    if (fancyConfigJSON && fancyConfigJSON.effects && fancyConfigJSON.effects.length > 0) {
      // 从前端 JSON 解析花字配置
      this.fancyTextConfig = TextStyle.parseFancyConfigJSON(fancyConfigJSON, this.textColor);
    } else {
      // 没有 JSON：使用基础样式（none）
      this.fancyTextConfig = this.getBaseEffectsFromNativeStyle();
    }
  }

  /**
   * 根据当前样式参数构造基础效果栈（不含复杂花字预设）
   */
  getBaseEffectsFromNativeStyle (): FancyTextStyle {
    const effects: FancyTextEffect[] = [];

    // 1. 阴影：只设置 ctx.shadowXXX，不画字
    if (this.hasShadow) {
      effects.push({
        type: 'shadow',
        params: {
          color: this.shadowColor,
          blur: this.shadowBlur,
          offsetX: this.shadowOffsetX,
          offsetY: this.shadowOffsetY,
        },
      });
    }

    // 2. 描边：如果启用描边，画一层等价于原新系统描边的效果
    if (this.isOutlined && this.outlineWidth > 0) {
      effects.push({
        type: 'single-stroke',
        params: {
          width: this.outlineWidth,
          color: this.outlineColor,
          unit: 'px',
        },
      });
    }

    // 3. 纯色填充：始终放在最后一层
    effects.push({
      type: 'solid-fill',
      params: {
        color: this.textColor,
      },
    });

    return {
      effects,
      editableParams: ['stroke', 'shadow', 'fill', 'curve'],
      enablePreset: false,
      presetName: 'none',
    };
  }

  /**
   * 获取当前花字配置
   */
  getCurrentFancyTextConfig (): FancyTextStyle {
    return this.fancyTextConfig;
  }

  /**
   * 静态工具：将前端 JSON 配置解析为 FancyTextStyle（花字配置）
   * @param json - 前端 JSON（仅描述效果栈）
   * @param fallbackFillColor - 当 solid-fill 没有给 color 时使用的默认颜色（可传 this.textColor）
   */
  static parseFancyConfigJSON (json: FancyConfigJSON, fallbackFillColor?: number[]): FancyTextStyle {
    const effects: FancyTextEffect[] = [];

    const layers = json.effects || [];

    if (layers.length === 0) {
      // 如果没有任何效果，默认给一个 solid-fill
      effects.push({
        type: 'solid-fill',
        params: {
          color: normalizeColor(fallbackFillColor ?? [0, 0, 0, 1]),
        },
      });
    } else {
      for (const layer of layers) {
        switch (layer.type) {
          case 'shadow': {
            const l = layer;

            effects.push({
              type: 'shadow',
              params: {
                color: normalizeColor(l.color ?? [0, 0, 0, 0.8]),
                blur: l.blur ?? 5,
                offsetX: l.offsetX ?? 0,
                offsetY: l.offsetY ?? 0,
              },
            });

            break;
          }
          case 'single-stroke': {
            const l = layer;

            effects.push({
              type: 'single-stroke',
              params: {
                width: l.width,
                color: normalizeColor(l.color),
                unit: l.unit ?? 'px',
              },
            });

            break;
          }
          case 'solid-fill': {
            const l = layer;

            effects.push({
              type: 'solid-fill',
              params: {
                color: normalizeColor(l.color ?? fallbackFillColor ?? [0, 0, 0, 1]),
              },
            });

            break;
          }
          case 'gradient': {
            const l = layer;
            const colors = (l.colors ?? [[1, 1, 1, 1]]).map(c => normalizeColor(c));
            const angle = l.angle ?? 0;

            effects.push({
              type: 'gradient',
              params: { colors, angle },
            });

            break;
          }
          case 'texture': {
            const l = layer;

            effects.push({
              type: 'texture',
              params: {
                imageUrl: l.imageUrl,
                pattern: null, // pattern 由运行时加载图片后设置
              },
            });

            break;
          }
        }
      }
    }

    return {
      effects,
      editableParams: ['stroke', 'shadow', 'fill', 'curve'],
      enablePreset: true,
      presetName: 'custom-json',
    };
  }

  /**
   * 实例方法：应用 JSON 配置覆盖当前 fancyTextConfig
   * @param json - 前端 JSON（仅描述效果栈）
   */
  applyFancyJson (json: FancyConfigJSON): void {
    // 使用当前 textColor 作为 solid-fill 的默认颜色
    const style = TextStyle.parseFancyConfigJSON(json, this.textColor);

    this.fancyTextConfig = style;
  }

  /**
   * 设置描边启用状态
   */
  setStrokeEnabled (enabled: boolean): void {
    if (!this.fancyTextConfig.editableParams?.includes('stroke')) {
      return;
    }

    this.isOutlined = enabled;

    if (enabled) {
      // 查找是否已有描边效果
      const hasStroke = this.fancyTextConfig.effects.some(e => e.type === 'single-stroke');

      if (!hasStroke) {
        // 在填充之前插入描边
        const fillIndex = this.fancyTextConfig.effects.findIndex(e => e.type === 'solid-fill');
        const strokeEffect: FancyTextEffect = {
          type: 'single-stroke',
          params: {
            width: this.outlineWidth || 3,
            color: this.outlineColor || [1, 0, 0, 1],
            unit: 'px',
          },
        };

        if (fillIndex >= 0) {
          this.fancyTextConfig.effects.splice(fillIndex, 0, strokeEffect);
        } else {
          this.fancyTextConfig.effects.push(strokeEffect);
        }
      }
    } else {
      // 移除所有描边效果
      this.fancyTextConfig.effects = this.fancyTextConfig.effects.filter(e => e.type !== 'single-stroke');
    }
  }

  /**
   * 设置阴影启用状态
   */
  setShadowEnabled (enabled: boolean): void {
    if (!this.fancyTextConfig.editableParams?.includes('shadow')) {
      return;
    }

    this.hasShadow = enabled;

    if (enabled) {
      // 查找是否已有阴影效果
      const hasShadow = this.fancyTextConfig.effects.some(e => e.type === 'shadow');

      if (!hasShadow) {
        // 阴影应该在最前面
        this.fancyTextConfig.effects.unshift({
          type: 'shadow',
          params: {
            color: this.shadowColor || [0, 0, 0, 0.8],
            blur: this.shadowBlur || 5,
            offsetX: this.shadowOffsetX || 5,
            offsetY: this.shadowOffsetY || 5,
          },
        });
      }
    } else {
      // 移除所有阴影效果
      this.fancyTextConfig.effects = this.fancyTextConfig.effects.filter(e => e.type !== 'shadow');
    }
  }

  /**
   * 更新描边参数
   */
  updateStrokeParams (params: { color?: number[], width?: number }): void {
    if (!this.fancyTextConfig.editableParams?.includes('stroke')) {
      return;
    }

    if (params.color) {
      this.outlineColor = normalizeColor(params.color);
    }
    if (params.width !== undefined) {
      this.outlineWidth = params.width;
    }

    // 更新所有描边效果
    this.fancyTextConfig.effects.forEach(effect => {
      if (effect.type === 'single-stroke') {
        if (params.color) {
          effect.params = effect.params || {};
          effect.params.color = this.outlineColor;
        }
        if (params.width !== undefined) {
          effect.params = effect.params || {};
          effect.params.width = params.width;
        }
      }
    });
  }

  /**
   * 更新阴影参数
   */
  updateShadowParams (params: {
    color?: number[],
    opacity?: number,
    blur?: number,
    distance?: number,
    angle?: number,
  }): void {
    if (!this.fancyTextConfig.editableParams?.includes('shadow')) {
      return;
    }

    // 更新内部状态
    if (params.color) {
      const [r, g, b] = normalizeColor(params.color);
      const a = params.opacity !== undefined ? params.opacity : this.shadowColor[3];

      this.shadowColor = [r, g, b, a];
    } else if (params.opacity !== undefined) {
      this.shadowColor[3] = params.opacity;
    }

    if (params.blur !== undefined) {
      this.shadowBlur = params.blur;
    }

    // 从距离和角度计算偏移
    if (params.distance !== undefined || params.angle !== undefined) {
      const distance = params.distance !== undefined ? params.distance : Math.sqrt(this.shadowOffsetX ** 2 + this.shadowOffsetY ** 2);
      const angle = params.angle !== undefined ? params.angle : Math.atan2(this.shadowOffsetY, this.shadowOffsetX) * 180 / Math.PI;
      const angleRad = angle * Math.PI / 180;

      this.shadowOffsetX = distance * Math.cos(angleRad);
      this.shadowOffsetY = distance * Math.sin(angleRad);
    }

    // 更新所有阴影效果
    this.fancyTextConfig.effects.forEach(effect => {
      if (effect.type === 'shadow') {
        effect.params = effect.params || {};
        effect.params.color = this.shadowColor;
        effect.params.blur = this.shadowBlur;
        effect.params.offsetX = this.shadowOffsetX;
        effect.params.offsetY = this.shadowOffsetY;
      }
    });
  }

  /**
   * 更新填充参数
   */
  updateFillParams (params: { color?: number[] }): void {
    if (!this.fancyTextConfig.editableParams?.includes('fill')) {
      return;
    }

    if (params.color) {
      this.textColor = normalizeColor(params.color);

      // 更新所有填充效果
      this.fancyTextConfig.effects.forEach(effect => {
        if (effect.type === 'solid-fill') {
          effect.params = effect.params || {};
          effect.params.color = this.textColor;
        }
      });
    }
  }

  /**
   * 设置文本颜色
   */
  setTextColor (value: spec.RGBAColorValue): void {
    const v = normalizeColor(value);

    if (this.textColor[0] === v[0] &&
        this.textColor[1] === v[1] &&
        this.textColor[2] === v[2] &&
        this.textColor[3] === v[3]) {
      return;
    }
    this.updateFillParams({ color: v });
  }

  /**
   * 设置外描边文本颜色
   */
  setOutlineColor (value: spec.RGBAColorValue): void {
    const v = normalizeColor(value);

    if (this.outlineColor[0] === v[0] &&
        this.outlineColor[1] === v[1] &&
        this.outlineColor[2] === v[2] &&
        this.outlineColor[3] === v[3]) {
      return;
    }
    this.updateStrokeParams({ color: v });
  }

  /**
   * 设置外描边宽度
   */
  setOutlineWidth (value: number): void {
    const v = Math.max(0, Number(value) || 0);

    if (this.outlineWidth === v) {
      return;
    }
    this.updateStrokeParams({ width: v });
  }

  /**
   * 设置阴影模糊
   */
  setShadowBlur (value: number): void {
    const v = Math.max(0, Number(value) || 0);

    if (this.shadowBlur === v) {
      return;
    }
    this.updateShadowParams({ blur: v });
  }

  /**
   * 设置阴影颜色
   */
  setShadowColor (value: spec.RGBAColorValue): void {
    const v = value ?? [0, 0, 0, 1];
    const normalized = normalizeColor(v);

    if (this.shadowColor[0] === normalized[0] &&
        this.shadowColor[1] === normalized[1] &&
        this.shadowColor[2] === normalized[2] &&
        this.shadowColor[3] === normalized[3]) {
      return;
    }
    this.updateShadowParams({ color: normalized });
  }

  /**
   * 设置阴影水平偏移
   */
  setShadowOffsetX (value: number): void {
    const v = Number(value) || 0;

    if (this.shadowOffsetX === v) {
      return;
    }
    this.shadowOffsetX = v;
    this.updateShadowParams({});
  }

  /**
   * 设置阴影垂直偏移
   */
  setShadowOffsetY (value: number): void {
    const v = Number(value) || 0;

    if (this.shadowOffsetY === v) {
      return;
    }
    this.shadowOffsetY = v;
    this.updateShadowParams({});
  }
}
