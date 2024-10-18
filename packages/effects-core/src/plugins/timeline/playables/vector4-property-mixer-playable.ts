import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';
import { PropertyClipPlayable } from './property-clip-playable';

export class Vector4PropertyMixerPlayable extends Playable {
  propertyName = '';

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData() as Record<string, any>;

    if (!boundObject) {
      return;
    }

    let hasInput = false;
    const value = boundObject[this.propertyName];

    if (!(value instanceof Vector4)) {
      return;
    }

    value.setZero();

    // evaluate the curve
    for (let i = 0; i < this.getInputCount(); i++) {
      const weight = this.getInputWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getInput(i) as PropertyClipPlayable<Vector4>;

        if (!(propertyClipPlayable instanceof PropertyClipPlayable)) {
          console.error('Vector4PropertyTrack added non-Vector4PropertyPlayableAsset');
          continue;
        }

        const curveValue = propertyClipPlayable.value;

        value.x += curveValue.x * weight;
        value.y += curveValue.y * weight;
        value.z += curveValue.z * weight;
        value.w += curveValue.w * weight;

        hasInput = true;
      }
    }

    // set value
    if (hasInput) {
      boundObject[this.propertyName] = value;
    }
  }
}

