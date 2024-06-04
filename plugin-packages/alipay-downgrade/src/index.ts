import { logger, registerPlugin, version as playerVersion } from '@galacean/effects';
import { DowngradeVFXItem } from './downgrade-vfx-item';
import { AlipayDowngradePlugin } from './alipay-downgrade-plugin';

export * from './utils';
export * from './native-log';

export const version = __VERSION__;

registerPlugin('alipay-downgrade', AlipayDowngradePlugin, DowngradeVFXItem, true);

logger.info('plugin downgrade version: ' + version);

if (version !== playerVersion) {
  console.error(
    '注意：请统一 Downgrade 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Downgrade plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
