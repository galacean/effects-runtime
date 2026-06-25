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

export type BaseLayerConfig =
  | SingleStrokeLayerConfig
  | SolidFillLayerConfig
  | GradientLayerConfig
  | TextureLayerConfig;

// ========== 花字整体配置 ==========

export interface FancyConfig {
  layers: BaseLayerConfig[],
  presetName?: string,
  /** 预设版本号，默认 1 */
  version?: number,
  /** 可调参数元信息列表 */
  adjustableParams?: AdjustableParamMeta[],
}

// ========== 预设调参 ==========

export interface AdjustableParamMeta {
  /** 点号分隔的属性路径，如 'layers.0.params.color' */
  path: string,
  /** UI 显示名称，如 '外描边颜色' */
  label: string,
  /** 参数类型，指导 UI 控件选择 */
  type: 'color' | 'number' | 'angle' | 'select',
  /** number/angle 类型的最小值 */
  min?: number,
  /** number/angle 类型的最大值 */
  max?: number,
  /** number/angle 类型的步进 */
  step?: number,
  /** select 类型的候选值 */
  options?: { label: string, value: unknown }[],
  /** UI 分组，如 '描边'、'填充'、'效果' */
  group?: string,
}

export interface AdjustableParam extends AdjustableParamMeta {
  /** 当前值（从 config 中按 path 读取） */
  value: unknown,
}

export type BaseLayerKind = 'single-stroke' | 'solid-fill' | 'gradient' | 'texture';
export type DecorativeLayerKind = 'shadow' | 'glow';

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
  presetName?: string,
}

// ========== 文字绘制环境 ==========

export interface TextEnv {
  fontDesc: string,
  style: any,
  layout: any,
  lines: any[],
  layer: { dispose: () => void },
  canvas: HTMLCanvasElement,
}

/** 文本层绘制器接口 */
export interface TextLayerDrawer {
  name?: string,
  category?: LayerCategory,
  render?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderDecorations?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderFill?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
}
