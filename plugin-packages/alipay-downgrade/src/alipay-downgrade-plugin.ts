import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin, logger } from '@galacean/effects';
import { getDefaultRenderLevel } from './utils';

/**
 * Alipay 降级插件类（内部用户使用）
 *
 * 根据 SceneLoadOptions 中传入的 downgrade 数据，判断是否降级。
 * 如果设备被降级，会在 processRawJSON 时抛出降级相关的异常和原因。
 *
 * 如果 SceneLoadOptions 中 renderLevel 没有设置，那么会根据 downgrade 数据
 * 和默认的渲染等级规则设置其中的 renderLevel 。
 */
export class AlipayDowngradePlugin extends AbstractPlugin {
  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {
    const downgradeResult = options.pluginData?.['downgrade'];

    if (downgradeResult) {
      if (downgradeResult.downgrade) {
        throw new Error(`Downgraded, reason: ${downgradeResult.reason}`);
      }
    } else {
      logger.warn('No downgrade result in pluginData of SceneLoadOptions.');
    }

    if (!options.renderLevel) {
      options.renderLevel = downgradeResult?.level ?? getDefaultRenderLevel();
    }
  }
}
