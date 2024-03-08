import { logger, registerPlugin } from '@galacean/effects';
import { DowngradeVFXItem } from './downgrade-vfx-item';
import { AlipayDowngradePlugin } from './alipay-downgrade-plugin';

export * from './utils';
export * from './native-log';

export const version = __VERSION__;

registerPlugin('alipay-downgrade', AlipayDowngradePlugin, DowngradeVFXItem, true);

logger.info('plugin alipay downgrade version: ' + version);
