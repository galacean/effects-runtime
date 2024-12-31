import type { FrameContext } from '../../cal/playable-graph';
import { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class FloatPropertyMixerPlayable extends TrackMixerPlayable {
  propertyName = '';

  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!boundObject) {
      return;
    }

    let hasInput = false;
    let value = 0;

    // evaluate the curve
    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.getClipWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getClipPlayable(i) as PropertyClipPlayable<number>;

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

