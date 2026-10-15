import { Component } from '../../../components/component';
import type { FrameContext } from '../playable';
import type { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export abstract class PropertyMixerPlayable<T> extends TrackMixerPlayable {
  propertyPath = '';

  protected propertyName = '';
  protected propertyValue: T;

  private directTarget: Record<string, any>;

  abstract resetPropertyValue (): void;
  abstract addWeightedValue (curveValue: T, weight: number): void;

  override evaluate (boundObject: object, context: FrameContext): void {
    if (!this.hasActiveClip()) {
      return;
    }
    if (!this.directTarget) {
      this.preparePath(boundObject);
    }

    this.propertyValue = this.directTarget[this.propertyName] as T;

    if (this.propertyValue === undefined || this.propertyValue === null) {
      return;
    }

    this.resetPropertyValue();

    // evaluate the curve
    for (const clip of this.activeClips) {
      const index = clip.playableIndex;
      const weight = this.getClipWeight(index);

      if (weight > 0) {
        const curveValue = (this.clipPlayables[index] as PropertyClipPlayable<T>).value;

        this.addWeightedValue(curveValue, weight);
      }
    }

    // set value
    this.directTarget[this.propertyName] = this.propertyValue;

    if (boundObject instanceof Component) {
      boundObject.onApplyAnimationProperties();
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

    this.propertyName = propertyPathSegments[propertyPathSegments.length - 1];
    this.directTarget = directTarget;
  }
}
