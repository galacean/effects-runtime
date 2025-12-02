import * as spec from '@galacean/effects-specification';
import type { Filter } from './text-filters';

/**
 * 滤镜配置接口
 */
export interface FilterOptions {
  blurRadius?: number,
  brightness?: number,
  contrast?: number,
  grayscale?: number,
  sepia?: number,
  invert?: number,
  saturate?: number,
  hueRotate?: number,
}

/**
 * 花字特效配置接口
 */
export interface FancyTextEffect {
  type: 'single-stroke' | 'multi-stroke' | 'gradient' | 'shadow' | 'texture' | 'solid-fill',
  params?: any,
}

/**
 * 花字样式配置
 */
export interface FancyTextStyle {
  effects: FancyTextEffect[],
  /**
   * 可编辑的参数列表
   */
  editableParams?: ('stroke' | 'shadow' | 'fill' | 'curve')[],
  /**
   * 是否启用描边（独立开关）
   * @default false
   */
  enableStroke?: boolean,
  /**
   * 是否启用阴影（独立开关）
   * @default false
   */
  enableShadow?: boolean,
  /**
   * 是否启用预设花字
   * @default false
   */
  enablePreset?: boolean,
  /**
   * 当前预设名称
   */
  presetName?: string,
  /**
   * 曲线文本强度
   * @default 0
   */
  curvedTextPower?: number,
  /**
   * 曲线文本路径（SVG路径字符串）
   */
  curvedTextPath?: string,
}

// 定义滤镜类型
export type FilterType = 'none' | 'blur' | 'brightness' | 'contrast' | 'grayscale' | 'invert' | 'sepia';

// 定义滤镜配置接口
export interface FilterConfig {
  name: string,
  css: string[],
  description: string,
}

// 可用的滤镜配置（仅CSS滤镜）
const _availableFilters: Record<FilterType, FilterConfig> = {
  none: {
    name: '无滤镜',
    css: [],
    description: '原始效果',
  },
  blur: {
    name: '模糊',
    css: ['blur(10px)'],
    description: '10px高斯模糊',
  },
  brightness: {
    name: '亮度',
    css: ['brightness(0.3)'],
    description: '30%亮度',
  },
  contrast: {
    name: '对比度',
    css: ['contrast(0.2)'],
    description: '20%对比度',
  },
  grayscale: {
    name: '灰度',
    css: ['grayscale(1)'],
    description: '完全灰度',
  },
  invert: {
    name: '反色',
    css: ['invert(1)'],
    description: '完全反色',
  },
  sepia: {
    name: '深褐色',
    css: ['sepia(1)'],
    description: '深褐色效果',
  },
};

// 花字特效配置 - 支持多特效组合
const _fancyTextConfigs: Record<string, FancyTextStyle> = {
  'none': {
    effects: [
      {
        type: 'solid-fill',
        params: {
          color: [0, 0, 0, 1], // 初始为白色，后续会被 textColor 覆盖
        },
      },
    ],
    editableParams: ['fill', 'curve'],
  },
  // 单描边填充花字
  'single-stroke': {
    effects: [
      {
        type: 'single-stroke',
        params: {
          width: 4,
          color: [1, 0.25, 0.54, 1], // #FF3F89
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 0.74, 0.84, 1], // #FFBCD7
        },
      },
    ],
    editableParams: ['stroke', 'curve'],
  },
  // 多描边花字（使用效果栈方式）
  'multi-stroke': {
    effects: [
      // 效果栈演示：多描边 + 填充
      // 顺序很关键：每一层都是"同色描边 + 同色填充"
      {
        type: 'single-stroke',
        params: {
          width: 15,
          color: [0.75, 0.28, 0.77, 1], // #C048C5 - 最外层紫色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [0.75, 0.28, 0.77, 1], // #C048C5 - 最外层紫色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 12,
          color: [0.44, 0.34, 0.81, 1], // #7057CF - 深紫色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [0.44, 0.34, 0.81, 1], // #7057CF - 深紫色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 9,
          color: [0.52, 0.89, 0.19, 1], // #86E431 - 绿色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [0.52, 0.89, 0.19, 1], // #86E431 - 绿色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 6,
          color: [1, 0.52, 0.36, 1], // #FF865B - 橙色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 0.52, 0.36, 1], // #FF865B - 橙色
        },
      },

      {
        type: 'single-stroke',
        params: {
          width: 3,
          color: [0.99, 0.19, 0.51, 1], // #FC3081 - 粉色
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 1, 1, 1], // 白色填充
        },
      },
    ],
    editableParams: ['shadow', 'fill', 'curve'], // 多描边预设允许修改阴影、填充和曲线
  },
  // 渐变花字
  'gradient': {
    effects: [
      {
        type: 'gradient',
        params: {
          colors: [
            { offset: 0, color: [1, 0.23, 0.23, 1] },     // #FF3A3A - 红色
            { offset: 1, color: [0.66, 0, 0, 1] },        // #A80101 - 深红色
          ],
          strokeWidth: 0.09,
          strokeColor: '#F8E8A2',
        },
      },
    ],
    editableParams: ['fill', 'curve'],
  },
  // 投影花字
  'shadow': {
    effects: [
      {
        type: 'shadow',
        params: {
          color: [0.93, 0.29, 0.29, 1], // #EE4949
          offsetX: 6,
          offsetY: 2,
          strokeWidth: 0.12,
          strokeColor: '#F7A4A4',
          topStrokeWidth: 0.04,
          topStrokeColor: '#FFFFFF',
        },
      },
      {
        type: 'solid-fill',
        params: {
          color: [1, 0.74, 0.84, 1], // #FFBCD7
        },
      },
    ],
    editableParams: ['shadow', 'fill', 'curve'],
  },
  // 纹理花字
  'texture': {
    effects: [
      {
        type: 'texture',
        params: {
          imageUrl: '/assets/text-effects/images/E9FE8222-61DA-46FB-A616-DCF1CC243558.png',
          strokeWidth: 0.04,
          strokeColor: '#9C4607',
        },
      },
    ],
    editableParams: ['curve'],
  },
};

const _currentEffect = 'none';

export class TextStyle {
  /**
   * 获取花字特效配置
   */
  static getFancyTextConfig (effectName: string = _currentEffect): FancyTextStyle {
    return _fancyTextConfigs[effectName] || _fancyTextConfigs['none'];
  }

  /**
   * 获取滤镜配置
   */
  static getFilterConfig (filterType: FilterType): FilterConfig {
    return _availableFilters[filterType] || _availableFilters['none'];
  }

  /**
   * 获取所有可用的滤镜配置
   */
  static getAllFilterConfigs (): Record<FilterType, FilterConfig> {
    return { ..._availableFilters };
  }

  /**
   * 获取所有可用的花字特效配置名称
   */
  static getAllFancyTextEffectNames (): string[] {
    return Object.keys(_fancyTextConfigs);
  }

  /**
   * 检查参数是否可编辑
   */
  canEditParam (key: 'stroke' | 'shadow' | 'fill' | 'curve'): boolean {
    const editable = this.fancyTextConfig?.editableParams;

    if (!editable || editable.length === 0) {
      return false;
    }

    return editable.includes(key);
  }

  /**
   * 设置预设花字
   */
  setPresetEffect (presetName: string): void {
    const preset = TextStyle.getFancyTextConfig(presetName);

    this.fancyTextConfig = {
      effects: preset.effects.map(e => ({ type: e.type, params: { ...(e.params || {}) } })),
      editableParams: preset.editableParams ? [...preset.editableParams] : [],
      enableStroke: preset.enableStroke,
      enableShadow: preset.enableShadow,
      enablePreset: true,
      presetName,
    };
  }

  /**
   * 启用/禁用描边
   */
  setStrokeEnabled (enabled: boolean): void {
    if (!this.canEditParam('stroke')) {
      console.warn('当前预设不允许修改描边开关');

      return;
    }
    if (!this.fancyTextConfig) {return;}

    if (!enabled) {
      this.fancyTextConfig.effects = this.fancyTextConfig.effects.filter(e => e.type !== 'single-stroke');
    } else {
      const exists = this.fancyTextConfig.effects.some(e => e.type === 'single-stroke');

      if (!exists) {
        this.fancyTextConfig.effects.push({
          type: 'single-stroke',
          params: {
            width: this.outlineWidth || 2,
            color: this.outlineColor || this.textColor || [1, 1, 1, 1],
          },
        });
      }
    }
  }

  /**
   * 启用/禁用阴影
   */
  setShadowEnabled (enabled: boolean): void {
    if (!this.canEditParam('shadow')) {
      console.warn('当前预设不允许修改阴影开关');

      return;
    }
    if (!this.fancyTextConfig) {return;}

    if (!enabled) {
      this.fancyTextConfig.effects = this.fancyTextConfig.effects.filter(e => e.type !== 'shadow');
    } else {
      const exists = this.fancyTextConfig.effects.some(e => e.type === 'shadow');

      if (!exists) {
        this.fancyTextConfig.effects.push({
          type: 'shadow',
          params: {
            color: this.shadowColor || [0, 0, 0, 0.8],
            blur: this.shadowBlur || 5,
            offsetX: this.shadowOffsetX || 5,
            offsetY: this.shadowOffsetY || 5,
          },
        });
      }
    }
  }

  /**
   * 更新描边参数
   */
  updateStrokeParams (params: { color?: spec.vec4, width?: number, enabled?: boolean }): void {
    if (!this.canEditParam('stroke')) {
      console.warn('当前预设不允许修改描边');

      return;
    }
    if (!this.fancyTextConfig) {return;}

    let hasStroke = false;

    for (const eff of this.fancyTextConfig.effects) {
      if (eff.type === 'single-stroke') {
        eff.params = eff.params || {};
        if (params.color) {eff.params.color = params.color;}
        if (params.width != null) {eff.params.width = params.width;}
        hasStroke = true;
      }
    }

    if (params.enabled === false) {
      this.fancyTextConfig.effects = this.fancyTextConfig.effects.filter(e => e.type !== 'single-stroke');
    } else if (params.enabled === true && !hasStroke) {
      this.fancyTextConfig.effects.push({
        type: 'single-stroke',
        params: {
          width: params.width ?? 2,
          color: params.color ?? this.textColor ?? [1, 1, 1, 1],
        },
      });
    }
  }

  /**
   * 更新阴影参数
   */
  updateShadowParams (params: {
    color?: spec.vec3 | spec.vec4,
    opacity?: number,
    blur?: number,
    distance?: number,
    angle?: number,
    offsetX?: number,
    offsetY?: number,
  }): void {
    if (!this.canEditParam('shadow')) {
      console.warn('当前预设不允许修改阴影');

      return;
    }
    if (!this.fancyTextConfig) {return;}

    let shadowEff = this.fancyTextConfig.effects.find(e => e.type === 'shadow');

    if (!shadowEff) {
      shadowEff = {
        type: 'shadow',
        params: {
          color: [0, 0, 0, 0.8],
          blur: 5,
          offsetX: 5,
          offsetY: 5,
        },
      };
      this.fancyTextConfig.effects.push(shadowEff);
    }
    const p = shadowEff.params || (shadowEff.params = {});

    // 颜色+透明度 -> vec4
    if (params.color || params.opacity != null) {
      const base = (params.color || p.color || [0, 0, 0, 1]) as number[];
      const r = base[0], g = base[1], b = base[2];
      const a = params.opacity != null ? params.opacity : (base[3] ?? 1);

      p.color = [r, g, b, a];
    }

    if (params.blur != null) {
      p.blur = params.blur;
    }

    // 距离+角度 -> offset
    if (params.distance != null || params.angle != null) {
      const distance = params.distance != null ? params.distance : Math.sqrt((p.offsetX || 0) ** 2 + (p.offsetY || 0) ** 2);
      const angleDeg = params.angle != null ? params.angle : 0;
      const rad = angleDeg * Math.PI / 180;

      p.offsetX = distance * Math.cos(rad);
      p.offsetY = distance * Math.sin(rad);
    }

    if (params.offsetX != null) {p.offsetX = params.offsetX;}
    if (params.offsetY != null) {p.offsetY = params.offsetY;}
  }

  /**
   * 更新填充参数
   */
  updateFillParams (params: { color?: spec.vec4 }): void {
    if (!this.canEditParam('fill')) {
      console.warn('当前预设不允许修改填充');

      return;
    }
    if (!this.fancyTextConfig) {return;}

    let fillEff = this.fancyTextConfig.effects.find(e => e.type === 'solid-fill');

    if (!fillEff) {
      fillEff = {
        type: 'solid-fill',
        params: {
          color: this.textColor ?? [1, 1, 1, 1],
        },
      };
      this.fancyTextConfig.effects.push(fillEff);
    }
    fillEff.params = fillEff.params || {};
    if (params.color) {
      fillEff.params.color = params.color;
    }
  }

  /**
   * 获取当前花字特效配置
   */
  getCurrentFancyTextConfig (): FancyTextStyle {
    return {
      ...this.fancyTextConfig,
      curvedTextPower: this.fancyTextConfig.curvedTextPower ?? 0,
      curvedTextPath: this.fancyTextConfig.curvedTextPath ?? '',
    };
  }

  /**
   * 字重
   */
  textWeight: spec.TextWeight; // ttf
  /**
   * 字体样式
   */
  fontStyle: spec.FontStyle; // ttf
  /**
   * 是否有下划线（暂时无效）
   */
  isUnderline = false; // ttf
  /**
   * 下划线高度（暂时无效）
   */
  underlineHeight = 1; // ttf
  /**
   * 是否有外描边
   */
  isOutlined = false; // both // ttf & char
  /**
   * 外描边颜色
   */
  outlineColor: spec.vec4;// both // ttf & char
  /**
   * 外描边宽度
   */
  outlineWidth = 0; // both // ttf & char
  /**
   * 是否有阴影
   */
  hasShadow = false; // ttf
  /**
   * 阴影颜色
   */
  shadowColor: spec.vec4; // ttf
  /**
   * 阴影模糊
   */
  shadowBlur: number; // ttf
  /**
   * 阴影水平偏移距离
   */
  shadowOffsetX: number; // ttf
  /**
   * 阴影高度偏移距离
   */
  shadowOffsetY: number; // ttf

  /**
   * 文本颜色
   */
  textColor: spec.vec4; // both

  /**
   * 字体大小
   */
  fontSize: number; // input fonSize // both
  // private maxFontSize = 100;

  // isSystemFontUsed = false; // both // ttf & char

  // font info // todo merge to font
  fontFamily: string; // both
  fontDesc = ''; // both

  /**
   * 字体倍数
   */
  fontScale = 2;

  /**
   * 滤镜列表
   */
  filters: Filter[] = [];

  /**
   * 花字特效配置
   */
  fancyTextConfig: FancyTextStyle;

  private _fontOffset = 0;
  get fontOffset () { return this._fontOffset; }

  constructor (options: spec.TextContentOptions) {
    // @ts-expect-error
    const { textColor = [1, 1, 1, 1], fontSize = 40, outline, shadow, fontWeight = 'normal', fontStyle = 'normal', fontFamily = 'sans-serif', filters } = options;

    this.textColor = textColor;
    //@ts-expect-error
    this.textWeight = fontWeight;
    //@ts-expect-error
    this.fontStyle = fontStyle;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;

    // 初始化花字配置
    const preset = TextStyle.getFancyTextConfig(_currentEffect);

    this.fancyTextConfig = {
      effects: preset.effects.map(e => ({ type: e.type, params: { ...(e.params || {}) } })),
      editableParams: preset.editableParams ? [...preset.editableParams] : [],
      enableStroke: preset.enableStroke,
      enableShadow: preset.enableShadow,
      enablePreset: true,
      presetName: _currentEffect,
    };

    // 处理传统属性
    if (outline) {
      this.isOutlined = true;
      this.outlineColor = outline.outlineColor ?? [1, 1, 1, 1];
      this.outlineWidth = outline.outlineWidth ?? 1;
      this.updateStrokeParams({
        color: this.outlineColor,
        width: this.outlineWidth,
        enabled: true,
      });
    }

    if (shadow) {
      this.hasShadow = true;
      this.shadowBlur = shadow.shadowBlur ?? 2;
      this.shadowColor = shadow.shadowColor ?? [0, 0, 0, 1];
      this.shadowOffsetX = shadow.shadowOffsetX ?? 0;
      this.shadowOffsetY = shadow.shadowOffsetY ?? 0;
      this.updateShadowParams({
        color: this.shadowColor,
        blur: this.shadowBlur,
        offsetX: this.shadowOffsetX,
        offsetY: this.shadowOffsetY,
      });
    }

    if (filters) {
      this.filters = filters;
    } else {
      this.filters = [];
    }

    if (this.fontStyle !== spec.FontStyle.normal) {
      this._fontOffset += this.fontSize * Math.tan(12 * 0.0174532925);
    }
  }
}
