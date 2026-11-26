import { Component } from '../../../components/component';
import type { FrameContext } from '../playable';
import type { CacheDataManager } from '../cache-data-manager';
import type { PropertyClipPlayable } from './property-clip-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export abstract class PropertyMixerPlayable<T> extends TrackMixerPlayable {
  propertyPath = '';

  protected propertyName = '';
  protected propertyValue: T;

  abstract resetPropertyValue (): void;
  abstract addWeightedValue (curveValue: T, weight: number): void;

  override evaluate (segmentId: number, boundObject: object | undefined, context: FrameContext, cache: CacheDataManager): void {
    if (!boundObject || !this.hasActiveClip(segmentId)) {
      return;
    }
    const segments = cache.getOrAddTrackData(() => this.propertyPath.split('.'));
    const directTarget = this.preparePath(boundObject, segments);

    if (!directTarget) {
      return;
    }
    this.propertyValue = directTarget[this.propertyName] as T;

    if (this.propertyValue === undefined || this.propertyValue === null) {
      return;
    }

    this.resetPropertyValue();

    // Blend the values sampled by the clips.
    for (const clip of this.getSegment(segmentId).clips) {
      const index = clip.playableIndex;
      const weight = this.getClipWeight(index);

      if (weight > 0) {
        const curveValue = (this.clipPlayables[index] as PropertyClipPlayable<T>).value;

        this.addWeightedValue(curveValue, weight);
      }
    }

    // set value
    directTarget[this.propertyName] = this.propertyValue;

    if (boundObject instanceof Component) {
      boundObject.onApplyAnimationProperties();
    }
  }

  private preparePath (target: object, propertyPathSegments: string[]) {
    let directTarget = target as Record<string, any>;

    for (let i = 0; i < propertyPathSegments.length - 1; i++) {
      const property = directTarget[propertyPathSegments[i]];

      if (property === undefined || property === null) {
        return;
      }
      directTarget = property;
    }

    this.propertyName = propertyPathSegments[propertyPathSegments.length - 1];

    return directTarget;
  }
}
