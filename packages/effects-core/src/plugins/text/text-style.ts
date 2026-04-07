import * as spec from '@galacean/effects-specification';
import type {
  FancyConfig,
  FancyRenderLayer,
  FancyRenderStyle,
} from './fancy-text/fancy-types';

function normalizeColor (rgba: number[]): [number, number, number, number] {
  if (!rgba || rgba.length < 3) { return [1, 1, 1, 1]; }
  const [r, g, b, a = 1] = rgba;

  if (r > 1 || g > 1 || b > 1) {
    return [r / 255, g / 255, b / 255, a];
  }

  return [r, g, b, a];
}

export class TextStyle {
  textWeight: spec.TextWeight;
  fontStyle: spec.FontStyle;
  isUnderline = false;
  underlineHeight = 1;
  isOutlined = false;
  outlineColor: spec.vec4;
  outlineWidth = 0;
  hasShadow = false;
  shadowColor: spec.vec4;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  textColor: spec.vec4;
  fontSize: number;
  fontFamily: string;
  fontDesc = '';
  fontScale = 2;
  fontOffset = 0;
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

    // 重置描边
    this.isOutlined = false;
    this.outlineColor = [1, 1, 1, 1];
    this.outlineWidth = 0;

    if (outline && (outline.outlineWidth ?? 0) > 0) {
      this.isOutlined = true;
      this.outlineColor = normalizeColor([...(outline.outlineColor ?? [1, 1, 1, 1])]);
      this.outlineWidth = outline.outlineWidth ?? 0;
    }

    // 重置阴影
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

    // 斜体偏移
    this.fontOffset = 0;
    if (this.fontStyle !== spec.FontStyle.normal) {
      this.fontOffset += this.fontSize * Math.tan(12 * 0.0174532925);
    }

    // 使用编辑器传入的 fancyRenderStyle，否则根据基础样式生成
    const frs = (options as unknown as { fancyRenderStyle?: FancyRenderStyle }).fancyRenderStyle;

    if (frs?.layers?.length) {
      this.fancyRenderStyle = frs;
    } else {
      this.fancyRenderStyle = this.getBaseRenderStyle();
    }
  }

  /** 根据当前样式参数构造基础渲染样式 */
  getBaseRenderStyle (): FancyRenderStyle {
    const layers: FancyRenderLayer[] = [];

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

    if (this.isOutlined && this.outlineWidth > 0) {
      layers.push({
        kind: 'single-stroke',
        params: { width: this.outlineWidth, color: this.outlineColor, unit: 'px' },
      });
    }

    layers.push({ kind: 'solid-fill', params: { color: this.textColor } });

    return { layers };
  }

  getCurrentFancyTextConfig (): FancyRenderStyle {
    return this.fancyRenderStyle;
  }

  /**
   * 将花字配置解析为 FancyRenderStyle，扁平化 decorations 到渲染层数组
   * @deprecated runtime 不再解析 FancyConfig，请在编辑器侧 flatten 后传 fancyRenderStyle
   */
  static parseFancyConfig (config: FancyConfig, fallbackFillColor?: spec.vec4): FancyRenderStyle {
    const layers: FancyRenderLayer[] = [];
    const srcLayers = config.layers || [];
    const fallback = fallbackFillColor ?? ([0, 0, 0, 1] as spec.vec4);

    if (srcLayers.length === 0) {
      layers.push({ kind: 'solid-fill', params: { color: fallback } });
    } else {
      for (const src of srcLayers) {
        // 展开 decorations
        const decorations = src.decorations;

        if (decorations?.length) {
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
          }
        }

        // 处理当前层
        switch (src.kind) {
          case 'single-stroke':
            layers.push({
              kind: 'single-stroke',
              params: { width: src.params.width, color: src.params.color, unit: src.params.unit ?? 'px' },
            });

            break;
          case 'solid-fill':
            layers.push({ kind: 'solid-fill', params: { color: src.params.color } });

            break;
          case 'gradient':
            layers.push({ kind: 'gradient', params: { colors: src.params.colors, angle: src.params.angle ?? 0 } });

            break;
          case 'texture':
            layers.push({ kind: 'texture', params: { pattern: src.params.pattern, opacity: src.params.opacity }, runtimePattern: null });

            break;
        }
      }
    }

    return { layers };
  }

  /** @deprecated runtime 不再解析 FancyConfig，请在编辑器侧 flatten 后传 fancyRenderStyle */
  applyFancyConfig (config: FancyConfig): void {
    this.fancyRenderStyle = TextStyle.parseFancyConfig(config, this.textColor);
  }

  setStrokeEnabled (enabled: boolean): void {
    this.isOutlined = enabled;

    if (enabled) {
      const hasStroke = this.fancyRenderStyle.layers.some(l => l.kind === 'single-stroke');

      if (!hasStroke) {
        const fillIndex = this.fancyRenderStyle.layers.findIndex(l => l.kind === 'solid-fill');
        const strokeLayer: FancyRenderLayer = {
          kind: 'single-stroke',
          params: { width: this.outlineWidth || 3, color: this.outlineColor || [1, 0, 0, 1], unit: 'px' },
        };

        if (fillIndex >= 0) {
          this.fancyRenderStyle.layers.splice(fillIndex, 0, strokeLayer);
        } else {
          this.fancyRenderStyle.layers.push(strokeLayer);
        }
      }
    } else {
      this.fancyRenderStyle.layers = this.fancyRenderStyle.layers.filter(l => l.kind !== 'single-stroke');
    }
  }

  setShadowEnabled (enabled: boolean): void {
    this.hasShadow = enabled;

    if (enabled) {
      const hasShadow = this.fancyRenderStyle.layers.some(l => l.kind === 'shadow');

      if (!hasShadow) {
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
      this.fancyRenderStyle.layers = this.fancyRenderStyle.layers.filter(l => l.kind !== 'shadow');
    }
  }

  updateStrokeParams (params: { color?: number[], width?: number }): void {
    if (params.color) {
      this.outlineColor = normalizeColor(params.color) as spec.vec4;
    }
    if (params.width !== undefined) {
      this.outlineWidth = params.width;
    }

    this.fancyRenderStyle.layers.forEach(layer => {
      if (layer.kind === 'single-stroke') {
        if (params.color) { layer.params.color = this.outlineColor; }
        if (params.width !== undefined) { layer.params.width = params.width; }
      }
    });
  }

  updateShadowParams (params: { color?: number[], opacity?: number, blur?: number, distance?: number, angle?: number }): void {
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

    if (params.distance !== undefined || params.angle !== undefined) {
      const distance = params.distance ?? Math.sqrt(this.shadowOffsetX ** 2 + this.shadowOffsetY ** 2);
      const angle = params.angle ?? Math.atan2(this.shadowOffsetY, this.shadowOffsetX) * 180 / Math.PI;
      const angleRad = angle * Math.PI / 180;

      this.shadowOffsetX = distance * Math.cos(angleRad);
      this.shadowOffsetY = distance * Math.sin(angleRad);
    }

    this.fancyRenderStyle.layers.forEach(layer => {
      if (layer.kind === 'shadow') {
        layer.params.color = this.shadowColor;
        layer.params.blur = this.shadowBlur;
        layer.params.offsetX = this.shadowOffsetX;
        layer.params.offsetY = this.shadowOffsetY;
      }
    });
  }

  updateFillParams (params: { color?: number[] }): void {
    if (params.color) {
      this.textColor = normalizeColor(params.color) as spec.vec4;
      this.fancyRenderStyle.layers.forEach(layer => {
        if (layer.kind === 'solid-fill') {
          layer.params.color = this.textColor;
        }
      });
    }
  }

  setTextColor (value: spec.RGBAColorValue): void {
    const v = normalizeColor(value);

    if (this.textColor[0] === v[0] && this.textColor[1] === v[1] && this.textColor[2] === v[2] && this.textColor[3] === v[3]) {
      return;
    }
    this.updateFillParams({ color: v });
  }

  setOutlineColor (value: spec.RGBAColorValue): void {
    const v = normalizeColor(value);

    if (this.outlineColor[0] === v[0] && this.outlineColor[1] === v[1] && this.outlineColor[2] === v[2] && this.outlineColor[3] === v[3]) {
      return;
    }
    this.updateStrokeParams({ color: v });
  }

  setOutlineWidth (value: number): void {
    const v = Math.max(0, Number(value) || 0);

    if (this.outlineWidth === v) { return; }
    this.updateStrokeParams({ width: v });
  }

  setShadowBlur (value: number): void {
    const v = Math.max(0, Number(value) || 0);

    if (this.shadowBlur === v) { return; }
    this.updateShadowParams({ blur: v });
  }

  setShadowColor (value: spec.RGBAColorValue): void {
    const v = value ?? [0, 0, 0, 1];
    const normalized = normalizeColor(v);

    if (this.shadowColor[0] === normalized[0] && this.shadowColor[1] === normalized[1] && this.shadowColor[2] === normalized[2] && this.shadowColor[3] === normalized[3]) {
      return;
    }
    this.updateShadowParams({ color: normalized });
  }

  setShadowOffsetX (value: number): void {
    const v = Number(value) || 0;

    if (this.shadowOffsetX === v) { return; }
    this.shadowOffsetX = v;
    this.updateShadowParams({});
  }

  setShadowOffsetY (value: number): void {
    const v = Number(value) || 0;

    if (this.shadowOffsetY === v) { return; }
    this.shadowOffsetY = v;
    this.updateShadowParams({});
  }
}

/** 示例：外发光 + 多重描边 + 渐变填充 */
export const GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 8, color: [0.1, 0.1, 0.1, 1] },
      decorations: [{ kind: 'shadow', params: { color: [0.3, 0.6, 1, 0.8], blur: 15, offsetX: 0, offsetY: 0 } }],
    },
    { kind: 'single-stroke', params: { width: 5, color: [0.3, 0.3, 0.3, 1] } },
    {
      kind: 'single-stroke',
      params: { width: 2, color: [0.6, 0.6, 0.6, 1] },
      decorations: [{ kind: 'shadow', params: { color: [1, 0.9, 0.5, 0.6], blur: 5, offsetX: 0, offsetY: 0 } }],
    },
    { kind: 'gradient', params: { colors: [[1, 0.2, 0.5, 1], [0.2, 0.5, 1, 1], [0.3, 1, 0.4, 1]], angle: 45 } },
  ],
};

/** 将花字配置扁平化为渲染样式（供编辑器调用） */
export function flattenFancyConfigToRenderStyle (fancyConfig: FancyConfig, fallbackFillColor?: spec.vec4): FancyRenderStyle {
  return TextStyle.parseFancyConfig(fancyConfig, fallbackFillColor);
}

/** 将花字配置扁平化为渲染层数组（供编辑器调用） */
export function flattenFancyConfigToLayers (fancyConfig: FancyConfig, fallbackFillColor?: spec.vec4): FancyRenderLayer[] {
  return TextStyle.parseFancyConfig(fancyConfig, fallbackFillColor).layers;
}

/** 示例：金属质感效果 */
export const METALLIC_SAMPLE: FancyConfig = {
  layers: [
    { kind: 'gradient', params: { colors: [[0.9, 0.9, 0.9, 1], [0.7, 0.7, 0.7, 1], [0.9, 0.9, 0.9, 1], [0.6, 0.6, 0.6, 1]], angle: 0 } },
    {
      kind: 'single-stroke',
      params: { width: 3, color: [0.3, 0.3, 0.3, 1] },
      decorations: [{ kind: 'shadow', params: { color: [1, 1, 1, 0.4], blur: 2, offsetX: 0, offsetY: -2 } }],
    },
  ],
};

/** 示例：霓虹灯效果 */
export const NEON_SAMPLE: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 4, color: [0, 0.8, 0.8, 1] },
      decorations: [{ kind: 'shadow', params: { color: [0, 1, 1, 0.8], blur: 20, offsetX: 0, offsetY: 0 } }],
    },
    { kind: 'single-stroke', params: { width: 2, color: [1, 1, 1, 1] } },
    { kind: 'solid-fill', params: { color: [0, 0.6, 0.6, 1] } },
  ],
};
