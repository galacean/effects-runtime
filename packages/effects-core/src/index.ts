import './polyfill';
import { registerFilters } from './filter';
import { registerPlugin } from './plugin-system';
import type { CalculateItem, CameraController, ParticleSystem, SpriteItem, InteractItem, TextItem } from './plugins';
import {
  CalculateLoader, CalculateVFXItem,
  CameraVFXItemLoader, CameraVFXItem,
  InteractLoader, InteractVFXItem,
  ParticleLoader, ParticleVFXItem,
  SpriteLoader, SpriteVFXItem,
  FilterSpriteVFXItem,
  TextLoader,
  TextVFXItem,
} from './plugins';
import { filters } from './filters';

export * as spec from '@galacean/effects-specification';
export {
  getStandardJSON,
  getStandardImage,
  getStandardComposition,
  getStandardItem,
} from '@galacean/effects-specification/dist/fallback';
export * as math from '@galacean/effects-math/es/core/index';
export * from './gl';
export * from './constants';
export * from './config';
export * from './utils';
export * from './math';
export * from './camera';
export * from './texture';
export * from './render';
export * from './material';
export * from './composition-source-manager';
export * from './scene';
export * from './asset-manager';
export * from './composition';
export * from './plugin-system';
export * from './transform';
export * from './plugins';
export * from './shader';
export * from './shape';
export * from './vfx-item';
export * from './filter';
export * from './template-image';
export * from './downloader';
export * from './paas-texture-cache';
export * from './semantic-map';
export * from './engine';
export * from './filters';
export * from './ticker';

registerPlugin<CameraController>('camera', CameraVFXItemLoader, CameraVFXItem, true);
registerPlugin<SpriteItem>('sprite', SpriteLoader, SpriteVFXItem, true);
registerPlugin<ParticleSystem>('particle', ParticleLoader, ParticleVFXItem, true);
registerPlugin<CalculateItem>('cal', CalculateLoader, CalculateVFXItem, true);
registerPlugin<InteractItem>('interact', InteractLoader, InteractVFXItem, true);
registerPlugin<SpriteItem>('filter', SpriteLoader, FilterSpriteVFXItem, true);
registerPlugin<TextItem>('text', TextLoader, TextVFXItem, true);
registerFilters(filters);
