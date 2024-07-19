import * as EFFECTS from '@galacean/effects';
import { VFXItem, logger, registerPlugin } from '@galacean/effects';
import { DowngradePlugin } from './downgrade-plugin';

export * from './utils';
export * from './parser';
export * from './ua-decoder';
export * from './types';

export const version = __VERSION__;

registerPlugin('downgrade', DowngradePlugin, VFXItem, true);

logger.info(`Plugin downgrade version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Downgrade 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Downgrade plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
