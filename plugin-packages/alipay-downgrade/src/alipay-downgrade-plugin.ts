import type { Player, SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';
import { checkDowngradeResult, getRenderLevelByDevice } from './utils';

export class AlipayDowngradePlugin extends AbstractPlugin {
  static glLostOccurred = false;

  static async onPlayerCreated (player: Player) {
    if (AlipayDowngradePlugin.glLostOccurred) {
      console.warn('gl lost happened, new player will be destroyed.');

      return player.dispose();
    }
  }

  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {
    if (AlipayDowngradePlugin.glLostOccurred) {
      return Promise.reject('gl lost happened');
    }

    const downgradeResult = options.pluginData?.['downgrade'];

    if (downgradeResult) {
      const downgradeDecision = checkDowngradeResult(downgradeResult);

      if (downgradeDecision.downgrade) {
        throw new Error(`downgraded, reason: ${downgradeDecision.reason}`);
      }
    } else {
      console.warn('No downgrade result in pluginData of SceneLoadOptions');
    }

    if (!options.renderLevel) {
      options.renderLevel = getRenderLevelByDevice(options.renderLevel);
    }
  }
}
