import { Component } from '../../../components/component';
import type { FrameContext } from '../playable';
import { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export abstract class PropertyMixerPlayable<T> extends TrackMixerPlayable {
  propertyPath = '';

  protected propertyName = '';
  protected propertyValue: T;

  private directTarget: Record<string, any>;

  abstract resetPropertyValue (): void;
  abstract addWeightedValue (curveValue: T, weight: number): void;

  override captureRestoreState (context: FrameContext): number {
    const boundObject = context.output.getUserData();

    if (!boundObject) {
      return -1;
    }
    if (!this.directTarget) {
      this.preparePath(boundObject);
    }
    const target = this.directTarget;
    const propertyName = this.propertyName;

    return this.trackInstance.composition.addRestoreData(cloneValue(target[propertyName] as T));
  }

  override restoreState (context: FrameContext, value: T): void {
    this.directTarget[this.propertyName] = cloneValue(value);
    const boundObject = context.output.getUserData();

    if (boundObject instanceof Component) {
      boundObject.onApplyAnimationProperties();
    }
  }

  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData() as Record<string, any>;

    if (!boundObject) {
      return;
    }

    if (!this.directTarget) {
      this.preparePath(boundObject);
    }

    let hasInput = false;

    this.propertyValue = this.directTarget[this.propertyName] as T;

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
      this.directTarget[this.propertyName] = this.propertyValue;

      if (boundObject instanceof Component) {
        boundObject.onApplyAnimationProperties();
      }
    }
  }

  private preparePath (target: object) {
    const propertyPathSegments = this.propertyPath.split('.');

    let directTarget = target as Record<string, any>;

    for (let i = 0; i < propertyPathSegments.length - 1; i++) {
      const property = directTarget[propertyPathSegments[i]];

      if (property === undefined) {
        console.error('The ' + propertyPathSegments[i] + ' property of ' + target + ' was not found');
      }
      directTarget = property;
    }

    if (propertyPathSegments.length > 0) {
      this.propertyName = propertyPathSegments[propertyPathSegments.length - 1];
    }

    this.directTarget = directTarget;
  }
}

function cloneValue<T> (value: T): T {
  const cloneable = value as T & { clone?: () => T };

  return typeof cloneable?.clone === 'function' ? cloneable.clone() : value;
}
