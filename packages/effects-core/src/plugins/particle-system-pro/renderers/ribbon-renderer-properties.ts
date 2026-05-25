import * as spec from '@galacean/effects-specification';
import type { Texture } from '../../../texture';
import { ProRendererProperties } from './renderer-properties';

export enum ProRibbonTextureMode {
  Stretch = 'stretch',
  Tile = 'tile',
}

export enum ProRibbonFacingMode {
  Camera = 'camera',
  Velocity = 'velocity',
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
}
