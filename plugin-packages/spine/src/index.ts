import { logger, registerPlugin } from '@galacean/effects';
import { SpineLoader } from './spine-loader';
import { SpineVFXItem } from './spine-vfx-item';
import {
  createSkeletonData,
  getAnimationDuration,
  getAnimationList,
  getSkinList,
  getSpineVersion,
  getTextureOptions,
  getAtlasFromBuffer,
  getSkeletonFromBuffer,
} from './utils';

export { SpineVFXItem } from './spine-vfx-item';

export * from '@esotericsoftware/spine-core';
export * from './spine-loader';
export {
  createSkeletonData,
  getAnimationDuration,
  getAnimationList,
  getSkinList,
  getTextureOptions,
  getSpineVersion,
  getAtlasFromBuffer,
  getSkeletonFromBuffer,
};

registerPlugin('spine', SpineLoader, SpineVFXItem);

export const version = __VERSION__;

logger.info('plugin spine version: ' + version);
