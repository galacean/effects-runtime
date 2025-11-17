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
  // 可以扩展更多花字相关属性
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
    effects: [],
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
    ],
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
  },
};

const _currentEffect = 'multi-stroke';

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

  readonly fontOffset = 0;

  constructor (options: spec.TextContentOptions) {
    // @ts-expect-error
    const { textColor = [1, 1, 1, 1], fontSize = 40, outline, shadow, fontWeight = 'normal', fontStyle = 'normal', fontFamily = 'sans-serif', filters } = options;

    this.textColor = textColor;
    //@ts-expect-error
    this.textWeight = fontWeight;
    //@ts-expect-error
    this.fontStyle = fontStyle;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize; // 暂时取消字号限制 Math.min(fontSize, this.maxFontSize);

    if (outline) {
      this.isOutlined = true;
      this.outlineColor = outline.outlineColor ?? [1, 1, 1, 1];
      this.outlineWidth = outline.outlineWidth ?? 1;
      //this.fontOffset += this.outlineWidth;
      //预期效果不需要因为描边而修改文字计算的宽度
      //当描边宽度扩大，最后效果是描边重叠
    }

    if (shadow) {
      this.hasShadow = true;
      this.shadowBlur = shadow.shadowBlur ?? 2;
      this.shadowColor = shadow.shadowColor ?? [0, 0, 0, 1];
      this.shadowOffsetX = shadow.shadowOffsetX ?? 0;
      this.shadowOffsetY = shadow.shadowOffsetY ?? 0;

    }

    if (filters) {
      this.filters = filters;
    } else {
      // 如果没有传入滤镜，使用配置中的无滤镜设置
      this.filters = _availableFilters['none'].css;
    }

    // 初始化花字特效配置
    this.fancyTextConfig = _fancyTextConfigs[_currentEffect];

    if (this.fontStyle !== spec.FontStyle.normal) {
      // 0.0174532925 = 3.141592653 / 180
      this.fontOffset += this.fontSize * Math.tan(12 * 0.0174532925);
    }

  }
}
