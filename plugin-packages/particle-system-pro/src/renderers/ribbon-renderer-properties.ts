import { spec } from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import { ProRendererProperties } from './renderer-properties';

export enum ProRibbonTextureMode {
  Stretch = 'stretch',
  Tile = 'tile',
  /**
   * 用 per-particle `Particle.RibbonUVDistance` 直接计算 `v = uvDist / tileLength`，
   * renderer 不在每帧扫一遍 sorted 序列算累计弧长。
   * 由 spawn 模块（如 SampleParticlesFromOtherEmitter）写入 UV distance。
   * 对应 UE Niagara `TiledFromStartOverRibbonLength`
   */
  TiledFromStart = 'tiledFromStart',
}

export enum ProRibbonFacingMode {
  Camera = 'camera',
  Velocity = 'velocity',
}

export type ProRibbonDrawDirection = 'frontToBack' | 'backToFront';

export enum ProRibbonTessellationMode {
  /** 不细分，相邻粒子直接连直线段（最便宜，原始行为） */
  Disabled = 'disabled',
  /** 每段固定 customSubdivisions 个细分点，可控 / 可预测 */
  Custom = 'custom',
  /** 用一个温和的固定细分数（4）— 视觉曲率改善 / 成本可接受 */
  Automatic = 'automatic',
}

/**
 * Ribbon Renderer 的编辑期配置。
 */
export class ProRibbonRendererProperties extends ProRendererProperties {
  texture: Texture | null = null;
  blending: spec.BlendingMode = spec.BlendingMode.ALPHA;
  widthScale = 1.0;
  textureMode: ProRibbonTextureMode = ProRibbonTextureMode.Stretch;
  tileLength = 1.0;
  facingMode: ProRibbonFacingMode = ProRibbonFacingMode.Camera;
  /**
   * 细分模式。Catmull-Rom 在原始粒子间插值出平滑曲线，避免低 spawn rate
   * 下 ribbon 出现明显折线感
   */
  tessellationMode: ProRibbonTessellationMode = ProRibbonTessellationMode.Disabled;
  /** Custom 模式下每段插入的细分点数（不含两端原始粒子） */
  customSubdivisions = 4;
  /**
   * Catmull-Rom 张力 [0, 1]。0 = 经典 Catmull-Rom（最平滑），
   * 1 = 退化成直线（等同 Disabled 的效果）。0.5 是温和的默认值。
   * 对应 UE Niagara `CurveTension`
   */
  curveTension = 0.5;
  drawDirection: ProRibbonDrawDirection = 'frontToBack';
  maxNumRibbons = 0;
}
