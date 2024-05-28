import { VFXItem, logger, registerPlugin } from '@galacean/effects';
import { SpineLoader } from './spine-loader';
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

export { SpineComponent } from './spine-component';
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

registerPlugin('spine', SpineLoader, VFXItem);

export const version = __VERSION__;

logger.info('plugin spine version: ' + version);
