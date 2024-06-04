import { VFXItem, logger, registerPlugin, version as playerVersion } from '@galacean/effects';
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

if (version !== playerVersion) {
  console.error(
    '注意：请统一 Spine 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Spine plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
