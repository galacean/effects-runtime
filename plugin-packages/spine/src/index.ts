import * as EFFECTS from '@galacean/effects';
import { AbstractPlugin, logger, registerPlugin, VFXItem } from '@galacean/effects';
import {
  createSkeletonData, getAnimationDuration, getAnimationList, getAtlasFromBuffer,
  getSkeletonFromBuffer, getSkinList, getSpineVersion, getTextureOptions,
} from './utils';

export * from './spine-component';
export * from '@esotericsoftware/spine-core';
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

registerPlugin<void>('spine', class SpineLoader extends AbstractPlugin { }, VFXItem);

export const version = __VERSION__;

logger.info(`Plugin spine version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Spine 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Spine plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
