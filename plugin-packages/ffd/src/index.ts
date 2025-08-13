import * as EFFECTS from '@galacean/effects';
import { logger, registerPlugin, VFXItem } from '@galacean/effects';
import { FFDLoader } from './ffd-loader';

export * from './ffd-component';

/**
 * 插件版本号
 */
export const version = __VERSION__;

registerPlugin('ffd', FFDLoader, VFXItem);

logger.info(`Plugin ffd version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 FFD 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the FFD plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
