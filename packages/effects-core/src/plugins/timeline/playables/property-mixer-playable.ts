import type { FrameContext } from '../../cal/playable-graph';
import { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export abstract class PropertyMixerPlayable<T> extends TrackMixerPlayable {
  propertyName = '';
  propertyValue: T;

  abstract resetPropertyValue (): void;
  abstract addWeightedValue (curveValue: T, weight: number): void;

  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData() as Record<string, any>;

    if (!boundObject) {
      return;
    }

    let hasInput = false;

    this.propertyValue = boundObject[this.propertyName] as T;

    if (this.propertyValue === undefined || this.propertyValue === null) {
      return;
    }

    this.resetPropertyValue();

    // evaluate the curve
    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.getClipWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getClipPlayable(i) as PropertyClipPlayable<T>;

        if (!(propertyClipPlayable instanceof PropertyClipPlayable)) {
          console.error('PropertyTrack added non-PropertyPlayableAsset');
          continue;
        }

        const curveValue = propertyClipPlayable.value;

        this.addWeightedValue(curveValue, weight);

        hasInput = true;
      }
    }

    // set value
    if (hasInput) {
      boundObject[this.propertyName] = this.propertyValue;
    }
  }
}