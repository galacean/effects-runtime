import type * as spec from '@galacean/effects-specification';

export type PatternRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
export type LayerCategory = 'base' | 'decorative';

export interface TexturePatternConfig {
  imageUrl: string,
  repeat?: PatternRepeat,
}

// ========== 装饰层配置 ==========

export interface ShadowLayerConfig {
  kind: 'shadow',
  category?: LayerCategory,
  params: { color: spec.vec4, blur: number, offsetX: number, offsetY: number },
}

export interface GlowLayerConfig {
  kind: 'glow',
  category?: LayerCategory,
  params: { color: spec.vec4, blur: number, intensity?: number },
}

export type DecorativeLayerConfig = ShadowLayerConfig | GlowLayerConfig;

// ========== 基础绘制层配置 ==========

export interface SingleStrokeLayerConfig {
  kind: 'single-stroke',
  category?: LayerCategory,
  params: { color: spec.vec4, width: number, unit?: 'px' },
  decorations?: DecorativeLayerConfig[],
}

export interface SolidFillLayerConfig {
  kind: 'solid-fill',
  category?: LayerCategory,
  params: { color: spec.vec4 },
  decorations?: DecorativeLayerConfig[],
}

export interface GradientLayerConfig {
  kind: 'gradient',
  category?: LayerCategory,
  params: { angle: number, colors: spec.vec4[] },
  decorations?: DecorativeLayerConfig[],
}

export interface TextureLayerConfig {
  kind: 'texture',
  category?: LayerCategory,
  params: { pattern: TexturePatternConfig, opacity?: number },
  decorations?: DecorativeLayerConfig[],
}

/**
 * 花字内容层配置。
 *
 * 这里的“内容层”是公开配置中的单个主绘制层，例如填充、描边、渐变或纹理；
 * 阴影、发光等装饰效果可以通过该层的 decorations 附着。
 */
export type FancyLayerConfig =
  | SingleStrokeLayerConfig
  | SolidFillLayerConfig
  | GradientLayerConfig
  | TextureLayerConfig;

/**
 * 富文本可复用的 Range 效果栈。
 *
 * 一个 stack 由多个内容层按顺序组成；rangeOverrides 中的正整数按 1 开始
 * 引用 FancyConfig.rangeStacks 中对应的 stack。
 */
export interface FancyRangeStack {
  /** 该 Range 使用的内容层列表。 */
  layers: FancyLayerConfig[],
  /** 仅用于编辑器或调试展示，运行时引用仍使用位置编号。 */
  name?: string,
}

/**
 * 富文本 Range 到效果栈的绑定：
 * - null：继承 FancyConfig.layers 默认效果栈；
 * - 正整数：按 1 开始引用 FancyConfig.rangeStacks；
 * - disable：禁用花字，只保留基础填充。
 */
export type FancyRangeOverride = null | number | { mode: 'disable' };

// ========== 花字整体配置 ==========

export interface FancyConfig {
  /** 默认效果栈，普通文本和未覆盖的 RichText Range 使用它。 */
  layers: FancyLayerConfig[],
  /** 可复用的 Range 效果栈表，公开 JSON 使用 1 开始的位置编号引用。 */
  rangeStacks?: FancyRangeStack[],
  /** 按 Parser 输出顺序，为每个 source range 指定效果栈。 */
  rangeOverrides?: FancyRangeOverride[],
}

// ========== 运行时渲染层 ==========

export type FancyRenderLayer =
  | { kind: 'shadow', category?: LayerCategory, params: { color: spec.vec4, blur: number, offsetX: number, offsetY: number } }
  | { kind: 'glow', category?: LayerCategory, params: { color: spec.vec4, blur: number, intensity: number } }
  | { kind: 'single-stroke', category?: LayerCategory, params: { color: spec.vec4, width: number, unit: 'px' } }
  | { kind: 'solid-fill', category?: LayerCategory, params: { color: spec.vec4 } }
  | { kind: 'gradient', category?: LayerCategory, params: { angle: number, colors: spec.vec4[] } }
  | { kind: 'texture', category?: LayerCategory, params: { pattern: TexturePatternConfig, opacity?: number }, runtimePattern?: CanvasPattern | null };

export interface FancyRenderStyle {
  layers: FancyRenderLayer[],
}

/** Runtime-only result of compiling the public FancyConfig for rich text. */
export interface FancyScopeResolution {
  defaultRangeLayers: FancyRenderLayer[],
  rangeStackLayers: FancyRenderLayer[][],
  objectLayers: FancyRenderLayer[],
  rangeOverrides: FancyRangeOverride[],
}
