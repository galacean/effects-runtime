import type { FrameContext } from '../../cal/playable-graph';
import { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';
import type { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Vector4 } from '@galacean/effects-math/es/core/vector4';

export abstract class VectorPropertyMixerPlayable<T extends Vector2 | Vector4> extends TrackMixerPlayable {
  propertyName = '';

  abstract addWeightedValue (curveValue: T, weight: number, outValue: T): void;

  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData() as Record<string, any>;

    if (!boundObject) {
      return;
    }

    let hasInput = false;
    const value = boundObject[this.propertyName] as T;

    if (!value) {
      return;
    }

    value.setZero();

    // evaluate the curve
    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.getClipWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getClipPlayable(i) as PropertyClipPlayable<T>;

        if (!(propertyClipPlayable instanceof PropertyClipPlayable)) {
          console.error('Vector4PropertyTrack added non-Vector4PropertyPlayableAsset');
          continue;
        }

        const curveValue = propertyClipPlayable.value;

        this.addWeightedValue(curveValue, weight, value);

        hasInput = true;
      }
    }

    // set value
    if (hasInput) {
      boundObject[this.propertyName] = value;
    }
  }
}

export class Vector4PropertyMixerPlayable extends VectorPropertyMixerPlayable<Vector4> {
  override addWeightedValue (curveValue: Vector4, weight: number, outValue: Vector4): void {
    outValue.x += curveValue.x * weight;
    outValue.y += curveValue.y * weight;
    outValue.z += curveValue.z * weight;
    outValue.w += curveValue.w * weight;
  }
}

export class Vector2PropertyMixerPlayable extends VectorPropertyMixerPlayable<Vector2> {
  override addWeightedValue (curveValue: Vector2, weight: number, outValue: Vector2): void {
    outValue.x += curveValue.x * weight;
    outValue.y += curveValue.y * weight;
  }
}

