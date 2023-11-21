import type { Player, SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';
import { checkDowngrade, getRenderLevelByDevice } from './utils';

export class AlipayDowngradePlugin extends AbstractPlugin {
  static currentBizId = '';
  static glLostOccurred = false;

  static async onPlayerCreated (player: Player) {
    if (AlipayDowngradePlugin.glLostOccurred) {
      console.warn('gl lost happened, new player will be destroyed.');

      return player.dispose();
    }
    if (AlipayDowngradePlugin.currentBizId) {
      const result = await checkDowngrade(AlipayDowngradePlugin.currentBizId);

      if (result.downgrade) {
        console.warn('automatically destroy downgraded player.');
        player.dispose();
      }
    }
  }

  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {
    if (AlipayDowngradePlugin.glLostOccurred) {
      return Promise.reject('gl lost happened');
    }

    const result = await checkDowngrade(options.pluginData?.['alipayBizId'] ?? AlipayDowngradePlugin.currentBizId);

    if (result.downgrade) {
      throw new Error(`downgraded, reason: ${result.reason}`);
    }

    if (!options.renderLevel) {
      options.renderLevel = getRenderLevelByDevice(options.renderLevel);
    }
  }
}
