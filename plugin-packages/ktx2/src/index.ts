import * as EFFECTS from '@galacean/effects';
import { logger } from '@galacean/effects';
import { registerKTX2Loader } from './ktx2-loader';

export * from './ktx2-loader';

/**
 * 插件版本号
 */
export const version = __VERSION__;

registerKTX2Loader();

logger.info(`Plugin ktx2 version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 KTX2 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the KTX2 plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
