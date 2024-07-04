import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';
import { checkDowngradeResult, getRenderLevelByDevice } from './utils';

export class AlipayDowngradePlugin extends AbstractPlugin {
  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {

    const downgradeResult = options.pluginData?.['downgrade'];

    if (downgradeResult) {
      const downgradeDecision = checkDowngradeResult(downgradeResult);

      if (downgradeDecision.downgrade) {
        throw new Error(`Downgraded, reason: ${downgradeDecision.reason}.`);
      }
    } else {
      console.warn('No downgrade result in pluginData of SceneLoadOptions.');
    }

    if (!options.renderLevel) {
      options.renderLevel = getRenderLevelByDevice(options.renderLevel);
    }
  }
}
