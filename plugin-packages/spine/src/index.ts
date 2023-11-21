import { registerPlugin } from '@galacean/effects';
import { SpineLoader } from './spine-loader';
import { SpineVFXItem } from './spine-vfx-item';
import {
  createSkeletonData,
  getAnimationDuration,
  getAnimationList,
  getSkinList,
  getSpineVersion,
  getTextureOptions,
} from './utils';

export { SpineVFXItem } from './spine-vfx-item';

export * from './core';
export * from './spine-loader';
export {
  createSkeletonData,
  getAnimationDuration,
  getAnimationList,
  getSkinList,
  getTextureOptions,
  getSpineVersion,
};

registerPlugin('spine', SpineLoader, SpineVFXItem);

export const version = __VERSION__;

console.info('[Galacean Effects Plugin Spine] version: ' + version);
