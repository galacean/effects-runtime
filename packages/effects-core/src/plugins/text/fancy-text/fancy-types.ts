/**
 * 花字层类型定义
 */
export type FancyLayerKind =
  | 'solid-fill'
  | 'single-stroke'
  | 'gradient'
  | 'texture'
  | 'shadow';

export type FancyLayerCategory = 'base' | 'decorative';

export interface FancyLayerJSONBase {
  kind: FancyLayerKind,
  category?: FancyLayerCategory,
}

export interface BaseLayerJSON extends FancyLayerJSONBase {
  kind: 'single-stroke' | 'solid-fill' | 'gradient' | 'texture',
  params?: Record<string, any>,
  decorations?: DecorativeLayerJSON[],
}

export interface DecorativeLayerJSON extends FancyLayerJSONBase {
  kind: 'shadow',
  params?: Record<string, any>,
}

export type FancyLayerJSON = BaseLayerJSON | DecorativeLayerJSON;

export interface FancyConfigJSON {
  layers: FancyLayerJSON[],
}

export type FancyRenderLayerCategory = 'base' | 'decorative';
export type BaseLayerKind = 'single-stroke' | 'solid-fill' | 'gradient' | 'texture';
export type DecorativeLayerKind = 'shadow';

export interface FancyRenderLayer {
  kind: BaseLayerKind | DecorativeLayerKind,
  category: FancyRenderLayerCategory,
  params?: Record<string, any>,
}

export interface FancyRenderStyle {
  layers: FancyRenderLayer[],
  presetName?: string,
}

/**
 * 文字绘制环境变量
 */
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

/**
 * 单个文本层绘制器：由花字层配置生成，用于绘制这一层的样式（描边/填充/渐变/阴影等）
 */
export interface TextLayerDrawer {
  name?: string,
  render?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderDecorations?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
  renderFill?: (ctx: CanvasRenderingContext2D, env: TextEnv) => void,
}
