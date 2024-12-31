import * as EFFECTS from '@galacean/effects';
import { logger, registerPlugin, VFXItem } from '@galacean/effects';
import { RichTextLoader } from './rich-text-loader';

export * from './rich-text-parser';
export * from './rich-text-component';
export * from './rich-text-loader';

/**
 * 插件版本号
 */
export const version = __VERSION__;

registerPlugin('richtext', RichTextLoader, VFXItem, true);

logger.info(`Plugin rich text version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 RichText 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the RichText plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
