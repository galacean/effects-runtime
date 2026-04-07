import type * as spec from '@galacean/effects-specification';

export type PatternRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

export interface TexturePatternConfig {
  imageUrl: string,
  repeat?: PatternRepeat,
}

/** 装饰层配置 */
export interface ShadowLayerConfig {
  kind: 'shadow',
  params: { color: spec.vec4, blur: number, offsetX: number, offsetY: number },
}

export type DecorativeLayerConfig = ShadowLayerConfig;

/** 基础绘制层配置，可挂装饰层 */
export interface SingleStrokeLayerConfig {
  kind: 'single-stroke',
  params: { color: spec.vec4, width: number, unit?: 'px' },
  decorations?: DecorativeLayerConfig[],
}

export interface SolidFillLayerConfig {
  kind: 'solid-fill',
  params: { color: spec.vec4 },
  decorations?: DecorativeLayerConfig[],
}

export interface GradientLayerConfig {
  kind: 'gradient',
  params: { angle: number, colors: spec.vec4[] },
  decorations?: DecorativeLayerConfig[],
}

export interface TextureLayerConfig {
  kind: 'texture',
  params: { pattern: TexturePatternConfig, opacity?: number },
  decorations?: DecorativeLayerConfig[],
}

export type BaseLayerConfig =
  | SingleStrokeLayerConfig
  | SolidFillLayerConfig
  | GradientLayerConfig
  | TextureLayerConfig;

/** 花字整体配置 */
export interface FancyConfig {
  layers: BaseLayerConfig[],
  presetName?: string,
}

export type BaseLayerKind = 'single-stroke' | 'solid-fill' | 'gradient' | 'texture';
export type DecorativeLayerKind = 'shadow';

export type FancyRenderLayer =
  | { kind: 'shadow', params: { color: spec.vec4, blur: number, offsetX: number, offsetY: number } }
  | { kind: 'single-stroke', params: { color: spec.vec4, width: number, unit: 'px' } }
  | { kind: 'solid-fill', params: { color: spec.vec4 } }
  | { kind: 'gradient', params: { angle: number, colors: spec.vec4[] } }
  | { kind: 'texture', params: { pattern: TexturePatternConfig, opacity?: number }, runtimePattern?: CanvasPattern | null };

export interface FancyRenderStyle {
  layers: FancyRenderLayer[],
  presetName?: string,
}

/** 文字绘制环境 */
export interface TextEnv {
  fontDesc: string,
  style: any,
  layout: any,
  lines: any[],
  layer: {
    dispose: () => void,
  },
  canvas: HTMLCanvasElement,
}

/** 文本层绘制器接口 */
export interface TextLayerDrawer {
  name?: string,
  render?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderDecorations?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderFill?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
}
