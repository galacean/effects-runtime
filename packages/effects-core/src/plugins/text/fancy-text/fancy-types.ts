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

/**
 * 花字层配置基类
 */
export interface FancyLayerConfigBase {
  kind: FancyLayerKind,
  category?: FancyLayerCategory,
}

/**
 * 基础绘制层配置（描边/填充/渐变/纹理），可以挂装饰层
 */
export interface BaseLayerConfig extends FancyLayerConfigBase {
  kind: 'single-stroke' | 'solid-fill' | 'gradient' | 'texture',
  params?: Record<string, any>,
  decorations?: DecorativeLayerConfig[],
}

/**
 * 装饰层配置（目前只有 shadow，将来可以扩展 glow 等）
 */
export interface DecorativeLayerConfig extends FancyLayerConfigBase {
  kind: 'shadow',
  params?: Record<string, any>,
}

/**
 * 花字层配置：基础层或装饰层
 */
export type FancyLayerConfig = BaseLayerConfig | DecorativeLayerConfig;

/**
 * 花字整体配置（编辑器 <-> runtime 协议）
 */
export interface FancyConfig {
  layers: FancyLayerConfig[],
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
