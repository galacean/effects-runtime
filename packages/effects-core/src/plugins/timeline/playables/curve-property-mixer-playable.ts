import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';
import { CurvePropertyClipPlayable } from './curve-property-clip-playable';
import { PropertyType } from '../tracks/curve-property-track';

export class CurvePropertyMixerPlayable extends Playable {
  propertyName = '';
  propertyType = PropertyType.Unknown;

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!boundObject) {
      return;
    }

    let hasInput = false;

    let value: number | Vector3 | null = null;

    switch (this.propertyType) {
      case PropertyType.Number:{
        value = 0;

        break;
      }
      case PropertyType.Vector3:{
        value = (boundObject as Record<string, any>)[this.propertyName] as Vector3;
        value.setZero();

        break;
      }
    }

    if (value === null) {
      return;
    }

    // evaluate the curve
    for (let i = 0; i < this.getInputCount(); i++) {
      const weight = this.getInputWeight(i);

      if (weight > 0) {
        const propertyClipPlayable = this.getInput(i);

        if (!(propertyClipPlayable instanceof CurvePropertyClipPlayable)) {
          console.error('CurvePropertyTrack added non-CurvePropertyPlayableAsset');
          continue;
        }

        switch (this.propertyType) {
          case PropertyType.Number:{
            const curveValue = propertyClipPlayable.value as number;

            (value as number) += curveValue * weight;

            break;
          }
          case PropertyType.Vector3:{
            const curveValue = propertyClipPlayable.value as Vector3;

            (value as Vector3).add(curveValue.clone().multiply(weight));

            break;
          }
        }

        hasInput = true;
      }
    }

    // set value
    if (hasInput) {
      (boundObject as Record<string, any>)[this.propertyName] = value;
    }
  }
}

