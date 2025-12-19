import * as spec from '@galacean/effects-specification';
import type {
  FancyRenderStyle,
  FancyRenderLayer,
  FancyConfig,
} from './fancy-text/fancy-types';

function normalizeColor (rgba: number[]): [number, number, number, number] {
  if (!rgba || rgba.length < 3) {return [1, 1, 1, 1];}
  const [r, g, b, a = 1] = rgba;

  if (r > 1 || g > 1 || b > 1) {
    return [r / 255, g / 255, b / 255, a];
  }

  return [r, g, b, a];
}

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
   * 花字渲染样式
   */
  fancyRenderStyle: FancyRenderStyle;

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

    // 只使用编辑器给的平铺结果
    const frs = (options as unknown as { fancyRenderStyle?: FancyRenderStyle }).fancyRenderStyle;

    if (frs?.layers?.length) {
      this.fancyRenderStyle = frs;
    } else {
      // 没给花字：使用基础样式（由 outline/shadow/textColor 决定）
      this.fancyRenderStyle = this.getBaseRenderStyle();
    }
  }

  /**
   * 根据当前样式参数构造基础渲染样式（不含复杂花字预设）
   */
  getBaseRenderStyle (): FancyRenderStyle {
    const layers: FancyRenderLayer[] = [];

    // 1. 阴影
    if (this.hasShadow) {
      layers.push({
        kind: 'shadow',
        params: {
          color: this.shadowColor,
          blur: this.shadowBlur,
          offsetX: this.shadowOffsetX,
          offsetY: this.shadowOffsetY,
        },
      });
    }

    // 2. 描边
    if (this.isOutlined && this.outlineWidth > 0) {
      layers.push({
        kind: 'single-stroke',
        params: {
          width: this.outlineWidth,
          color: this.outlineColor,
          unit: 'px',
        },
      });
    }

    // 3. 填充
    layers.push({
      kind: 'solid-fill',
      params: {
        color: this.textColor,
      },
    });

    return { layers };
  }

  /**
   * 获取当前花字配置
   */
  getCurrentFancyTextConfig (): FancyRenderStyle {
    return this.fancyRenderStyle;
  }

  /**
   * 静态工具：将花字配置解析为 FancyRenderStyle
   *
   * 本方法会把 BaseLayerConfig.decorations 中挂载的装饰层扁平化到渲染层数组中。
   * 处理顺序：先展开 decorations（shadow 等），再添加当前 base 层本身。
   *
   * @param config - 花字配置
   * @param fallbackFillColor - 当 solid-fill 没有给 color 时使用的默认颜色（可传 this.textColor）
   * @returns FancyRenderStyle - 扁平化后的渲染层配置
   */
  static parseFancyConfig (config: FancyConfig, fallbackFillColor?: spec.vec4): FancyRenderStyle {
    const layers: FancyRenderLayer[] = [];
    const srcLayers = config.layers || [];
    const fallback = fallbackFillColor ?? ([0, 0, 0, 1] as spec.vec4);

    if (srcLayers.length === 0) {
      layers.push({
        kind: 'solid-fill',
        params: {
          color: fallback,
        },
      });
    } else {
      for (const src of srcLayers) {
        // 1. 如果是 BaseLayerConfig，先展开 decorations
        const decorations = src.decorations;

        if (decorations && decorations.length > 0) {
          for (const d of decorations) {
            if (d.kind === 'shadow') {
              layers.push({
                kind: 'shadow',
                params: {
                  color: d.params.color,
                  blur: d.params.blur ?? 5,
                  offsetX: d.params.offsetX ?? 0,
                  offsetY: d.params.offsetY ?? 0,
                },
              });
            }
            // 将来新增 glow 等，也在这里展开
          }
        }

        // 2. 再处理当前层本身
        switch (src.kind) {
          case 'single-stroke': {
            layers.push({
              kind: 'single-stroke',
              params: {
                width: src.params.width,
                color: src.params.color,
                unit: src.params.unit ?? 'px',
              },
            });

            break;
          }
          case 'solid-fill': {
            layers.push({
              kind: 'solid-fill',
              params: {
                color: src.params.color,
              },
            });

            break;
          }
          case 'gradient': {
            const colors = src.params.colors;
            const angle = src.params.angle ?? 0;

            layers.push({
              kind: 'gradient',
              params: { colors, angle },
            });

            break;
          }
          case 'texture': {
            layers.push({
              kind: 'texture',
              params: {
                pattern: src.params.pattern,
              },
              runtimePattern: null,
            });

            break;
          }

        }
      }
    }

    return {
      layers,
    };
  }

  /**
   * 实例方法：应用花字配置覆盖当前 fancyRenderStyle
   * @param config - 花字配置
   * @deprecated runtime 不再解析 FancyConfig（层级结构），请在编辑器侧 flatten 后传 fancyRenderStyle
   */
  applyFancyConfig (config: FancyConfig): void {
    // 使用当前 textColor 作为 solid-fill 的默认颜色
    const style = TextStyle.parseFancyConfig(config, this.textColor);

    this.fancyRenderStyle = style;
  }

  /**
   * 设置描边启用状态
   */
  setStrokeEnabled (enabled: boolean): void {
    this.isOutlined = enabled;

    if (enabled) {
      // 查找是否已有描边效果
      const hasStroke = this.fancyRenderStyle.layers.some(l => l.kind === 'single-stroke');

      if (!hasStroke) {
        // 在填充之前插入描边
        const fillIndex = this.fancyRenderStyle.layers.findIndex(l => l.kind === 'solid-fill');
        const strokeLayer: FancyRenderLayer = {
          kind: 'single-stroke',
          params: {
            width: this.outlineWidth || 3,
            color: this.outlineColor || [1, 0, 0, 1],
            unit: 'px',
          },
        };

        if (fillIndex >= 0) {
          this.fancyRenderStyle.layers.splice(fillIndex, 0, strokeLayer);
        } else {
          this.fancyRenderStyle.layers.push(strokeLayer);
        }
      }
    } else {
      // 移除所有描边效果
      this.fancyRenderStyle.layers = this.fancyRenderStyle.layers.filter(l => l.kind !== 'single-stroke');
    }
  }

  /**
   * 设置阴影启用状态
   */
  setShadowEnabled (enabled: boolean): void {
    this.hasShadow = enabled;

    if (enabled) {
      // 查找是否已有阴影效果
      const hasShadow = this.fancyRenderStyle.layers.some(l => l.kind === 'shadow');

      if (!hasShadow) {
        // 阴影应该在最前面
        this.fancyRenderStyle.layers.unshift({
          kind: 'shadow',
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
      this.fancyRenderStyle.layers = this.fancyRenderStyle.layers.filter(l => l.kind !== 'shadow');
    }
  }

  /**
   * 更新描边参数
   */
  updateStrokeParams (params: { color?: number[], width?: number }): void {
    if (params.color) {
      this.outlineColor = normalizeColor(params.color) as spec.vec4;
    }
    if (params.width !== undefined) {
      this.outlineWidth = params.width;
    }

    // 更新所有描边效果
    this.fancyRenderStyle.layers.forEach(layer => {
      if (layer.kind === 'single-stroke') {
        if (params.color) {layer.params.color = this.outlineColor;}
        if (params.width !== undefined) {layer.params.width = params.width;}
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
    // 更新内部状态
    if (params.color) {
      const [r, g, b] = normalizeColor(params.color);
      const a = params.opacity !== undefined ? params.opacity : this.shadowColor[3];

      this.shadowColor = [r, g, b, a] as spec.vec4;
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
    this.fancyRenderStyle.layers.forEach(layer => {
      if (layer.kind === 'shadow') {
        layer.params.color = this.shadowColor;
        layer.params.blur = this.shadowBlur;
        layer.params.offsetX = this.shadowOffsetX;
        layer.params.offsetY = this.shadowOffsetY;
      }
    });
  }

  /**
   * 更新填充参数
   */
  updateFillParams (params: { color?: number[] }): void {
    if (params.color) {
      this.textColor = normalizeColor(params.color) as spec.vec4;

      // 更新所有填充效果
      this.fancyRenderStyle.layers.forEach(layer => {
        if (layer.kind === 'solid-fill') {
          layer.params.color = this.textColor;
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

/**
 * 一个模拟 JSON 示例：外发光 + 内发光 + 多重描边 + 渐变填充（挂载版本）
 * 可在 demo 或测试中直接用 TextStyle.parseFancyConfig(GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE)
 */
export const GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE: FancyConfig = {
  layers: [
    // 外层描边 + 挂在它上面的外发光
    {
      kind: 'single-stroke',
      params: {
        width: 8,
        color: [0.1, 0.1, 0.1, 1],
      },
      decorations: [
        {
          kind: 'shadow',
          params: {
            color: [0.3, 0.6, 1, 0.8],
            blur: 15,
            offsetX: 0,
            offsetY: 0,
          },
        },
      ],
    },
    // 中层描边
    {
      kind: 'single-stroke',
      params: {
        width: 5,
        color: [0.3, 0.3, 0.3, 1],
      },
    },
    // 内层描边 + 挂在它上面的内发光
    {
      kind: 'single-stroke',
      params: {
        width: 2,
        color: [0.6, 0.6, 0.6, 1],
      },
      decorations: [
        {
          kind: 'shadow',
          params: {
            color: [1, 0.9, 0.5, 0.6],
            blur: 5,
            offsetX: 0,
            offsetY: 0,
          },
        },
      ],
    },
    // 渐变填充
    {
      kind: 'gradient',
      params: {
        colors: [
          [1, 0.2, 0.5, 1],
          [0.2, 0.5, 1, 1],
          [0.3, 1, 0.4, 1],
        ],
        angle: 45,
      },
    },
  ],
};

/**
 * 将花字配置解析为平铺的渲染样式
 * 供编辑器调用，将层级结构的 fancyConfig 转换为平铺的 fancyRenderStyle
 *
 * @param fancyConfig - 层级结构的花字配置
 * @param fallbackFillColor - 当 solid-fill 没有给 color 时使用的默认颜色
 * @returns FancyRenderStyle - 平铺后的渲染层配置
 */
export function flattenFancyConfigToRenderStyle (
  fancyConfig: FancyConfig,
  fallbackFillColor?: spec.vec4,
): FancyRenderStyle {
  return TextStyle.parseFancyConfig(fancyConfig, fallbackFillColor);
}

/**
 * 将花字配置解析为平铺的渲染层数组
 * 供编辑器调用，将层级结构的 fancyConfig 转换为平铺的 layers 数组
 *
 * @param fancyConfig - 层级结构的花字配置
 * @param fallbackFillColor - 当 solid-fill 没有给 color 时使用的默认颜色
 * @returns FancyRenderLayer[] - 平铺后的渲染层数组
 */
export function flattenFancyConfigToLayers (
  fancyConfig: FancyConfig,
  fallbackFillColor?: spec.vec4,
): FancyRenderLayer[] {
  return TextStyle.parseFancyConfig(fancyConfig, fallbackFillColor).layers;
}

/**
 * 一个模拟 JSON 示例：金属质感效果（挂载版本）
 * 可在 demo 或测试中直接用 TextStyle.parseFancyConfig(METALLIC_SAMPLE)
 */
export const METALLIC_SAMPLE: FancyConfig = {
  layers: [
    // 金属光泽效果
    {
      kind: 'gradient',
      params: {
        colors: [
          [0.9, 0.9, 0.9, 1],
          [0.7, 0.7, 0.7, 1],
          [0.9, 0.9, 0.9, 1],
          [0.6, 0.6, 0.6, 1],
        ],
        angle: 0,
      },
    },
    // 金属边框 + 挂在它上面的高光
    {
      kind: 'single-stroke',
      params: {
        width: 3,
        color: [0.3, 0.3, 0.3, 1],
      },
      decorations: [
        {
          kind: 'shadow',
          params: {
            color: [1, 1, 1, 0.4],
            blur: 2,
            offsetX: 0,
            offsetY: -2,
          },
        },
      ],
    },
  ],
};

/**
 * 一个模拟 JSON 示例：霓虹灯效果（挂载版本）
 * 可在 demo 或测试中直接用 TextStyle.parseFancyConfig(NEON_SAMPLE)
 */
export const NEON_SAMPLE: FancyConfig = {
  layers: [
    // 霓虹边框 + 挂在它上面的霓虹光晕
    {
      kind: 'single-stroke',
      params: {
        width: 4,
        color: [0, 0.8, 0.8, 1],
      },
      decorations: [
        {
          kind: 'shadow',
          params: {
            color: [0, 1, 1, 0.8],
            blur: 20,
            offsetX: 0,
            offsetY: 0,
          },
        },
      ],
    },
    // 霓虹核心
    {
      kind: 'single-stroke',
      params: {
        width: 2,
        color: [1, 1, 1, 1],
      },
    },
    // 霓虹填充
    {
      kind: 'solid-fill',
      params: {
        color: [0, 0.6, 0.6, 1],
      },
    },
  ],
};
