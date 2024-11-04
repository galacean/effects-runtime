import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';
import { PropertyClipPlayable } from './property-clip-playable';

export class FloatPropertyMixerPlayable extends Playable {
  propertyName = '';

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!boundObject) {
      return;
    }

    let hasInput = false;
    let value = 0;

    // evaluate the curve
    for (let i = 0; i < this.getInputCount(); i++) {
      const weight = this.getInputWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getInput(i) as PropertyClipPlayable<number>;

        if (!(propertyClipPlayable instanceof PropertyClipPlayable)) {
          console.error('FloatPropertyTrack added non-FloatPropertyPlayableAsset');
          continue;
        }

        const curveValue = propertyClipPlayable.value;

        value += curveValue * weight;

        hasInput = true;
      }
    }

    // set value
    if (hasInput) {
      (boundObject as Record<string, any>)[this.propertyName] = value;
    }
  }
}

