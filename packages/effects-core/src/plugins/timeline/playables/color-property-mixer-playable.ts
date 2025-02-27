import { Color } from '@galacean/effects-math/es/core/color';
import type { FrameContext } from '../../cal/playable-graph';
import { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ColorPropertyMixerPlayable extends TrackMixerPlayable {
  propertyName = '';

  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData() as Record<string, any>;

    if (!boundObject) {
      return;
    }

    let hasInput = false;
    const value = boundObject[this.propertyName];

    if (!(value instanceof Color)) {
      return;
    }

    value.setZero();

    // evaluate the curve
    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.getClipWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getClipPlayable(i) as PropertyClipPlayable<Color>;

        if (!(propertyClipPlayable instanceof PropertyClipPlayable)) {
          console.error('ColorPropertyMixerPlayable received incompatible input');
          continue;
        }

        const curveValue = propertyClipPlayable.value;

        value.r += curveValue.r * weight;
        value.g += curveValue.g * weight;
        value.b += curveValue.b * weight;
        value.a += curveValue.a * weight;

        hasInput = true;
      }
    }

    // set value
    if (hasInput) {
      boundObject[this.propertyName] = value;
    }
  }
}

