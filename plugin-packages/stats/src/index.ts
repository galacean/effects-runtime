import * as EFFECTS from '@galacean/effects';
import { logger } from '@galacean/effects';

export * from './stats';

/**
 * 插件版本号
 */
export const version = __VERSION__;

logger.info(`Plugin stats version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Stats 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Stats plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
