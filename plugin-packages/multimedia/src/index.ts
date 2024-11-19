import * as EFFECTS from '@galacean/effects';
import { logger, registerPlugin, VFXItem } from '@galacean/effects';
import { VideoLoader } from './video/video-loader';
import { AudioLoader } from './audio/audio-loader';

export * from './video/video-component';
export * from './audio/audio-component';
export * from './audio/audio-player';
export * from './constants';
export * from './utils';

/**
 * 插件版本号
 */
export const version = __VERSION__;

registerPlugin('video', VideoLoader, VFXItem, true);
registerPlugin('audio', AudioLoader, VFXItem, true);

logger.info(`Plugin multimedia version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Multimedia 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Multimedia plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
