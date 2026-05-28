import type { spec } from '@galacean/effects';
import type { ProModuleData } from '../simulation/module-serialization';

/**
 * Sprite Renderer 属性的 JSON 形态。
 *
 * texture 字段不直接序列化（GPUTexture 不可 JSON-stringify）；
 * 用 textureUrl 字段记录来源 URL，反序列化时异步重新加载。
 */
export interface ProSpriteRendererPropertiesData {
  textureUrl?: string,
  blending?: spec.BlendingMode,
  facingMode?: 'billboard' | 'velocity' | 'unaligned',
  sortMode?: 'none' | 'viewDepth' | 'distance' | 'age',
  subUVRows?: number,
  subUVCols?: number,
  subUVTotal?: number,
}

export interface ProRibbonRendererPropertiesData {
  textureUrl?: string,
  blending?: spec.BlendingMode,
  widthScale?: number,
  textureMode?: 'stretch' | 'tile' | 'tiledFromStart',
  tileLength?: number,
  facingMode?: 'camera' | 'velocity',
  tessellationMode?: 'disabled' | 'custom' | 'automatic',
  customSubdivisions?: number,
  curveTension?: number,
  useRibbonId?: boolean,
}

export interface ProRendererSnapshot {
  type: 'sprite' | 'ribbon',
  properties: ProSpriteRendererPropertiesData | ProRibbonRendererPropertiesData,
}

export interface ProEmitterData {
  name?: string,
  modules: ProModuleData[],
}

// 不直接 extend spec.ComponentData：spec 上 id/dataType/item 是 required，对于纯快照
// 这些字段没有意义；下游需要的话可以在 toData 结果上自行附加。
export interface ProParticleSystemComponentData extends Partial<spec.ComponentData> {
  emitters?: ProEmitterData[],
}

export interface ProParticleSystemRendererComponentData extends Partial<spec.ComponentData> {
  renderers?: ProRendererSnapshot[],
}
