import { registerPlugin } from './plugin-system';
import {
  CalculateLoader, CameraVFXItemLoader, InteractLoader, ParticleLoader, SpriteLoader, TextLoader,
} from './plugins';
import { logger } from './utils';

export * as math from '@galacean/effects-math/es/core/index';
export * as spec from '@galacean/effects-specification';
export * from './asset';
export * from './binary-asset';
export * from './asset-loader';
export * from './asset-manager';
export * from './asset-service';
export * from './camera';
export * from './canvas-pool';
export * from './comp-vfx-item';
export * from './components';
export * from './animation';
export * from './composition';
export * from './config';
export * from './constants';
export * from './decorators';
export * from './downloader';
export * from './effects-object';
export * from './engine';
export {
  ensureFixedNumber, getStandardComposition, getStandardImage, getStandardItem,
  getStandardJSON, normalizeColor,
} from './fallback';
export * from './gl';
export * from './material';
export * from './math';
export * from './paas-texture-cache';
export * from './plugin-system';
export * from './scene-loader';
export * from './plugins';
export * from './render';
export * from './scene';
export * from './serialization-helper';
export * from './shader';
export * from './shape';
export * from './template-image';
export * from './texture';
export * from './ticker';
export * from './transform';
export * from './utils';
export * from './vfx-item';
export * from './effects-object';
export * from './effects-package';
export * from './events';
export * from './pass-render-level';

registerPlugin('camera', CameraVFXItemLoader);
registerPlugin('text', TextLoader);
registerPlugin('sprite', SpriteLoader);
registerPlugin('particle', ParticleLoader);
registerPlugin('cal', CalculateLoader);
registerPlugin('interact', InteractLoader);

export const version = __VERSION__;

logger.info(`Core version: ${version}.`);
