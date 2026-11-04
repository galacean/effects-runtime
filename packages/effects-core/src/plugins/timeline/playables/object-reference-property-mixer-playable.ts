import { Component } from '../../../components/component';
import type { EffectsObject } from '../../../effects-object';
import type { FrameContext } from '../playable';
import type { CacheDataManager } from '../cache-data-manager';
import { TrackMixerPlayable } from './track-mixer-playable';
import type { PropertyClipPlayable } from './property-clip-playable';

/** Writes the first active clip's reference through the configured property path. */
export class ObjectReferencePropertyMixerPlayable extends TrackMixerPlayable {
  propertyPath = '';

  override evaluate (segmentId: number, boundObject: object | undefined, context: FrameContext, cache: CacheDataManager): void {
    if (!boundObject || !this.propertyPath) {
      return;
    }
    for (const clipData of this.getSegment(segmentId).clips) {
      const index = clipData.playableIndex;

      if (this.getClipWeight(index) > 0) {
        const clip = this.clipPlayables[index] as PropertyClipPlayable<EffectsObject | null>;

        if (clip.value !== undefined) {
          const properties = this.propertyPath.split('.');
          let target = boundObject as Record<string, unknown>;

          for (let i = 0; i < properties.length - 1; i++) {
            target = target[properties[i]] as Record<string, unknown>;
          }
          target[properties[properties.length - 1]] = clip.value;
          if (boundObject instanceof Component) {
            boundObject.onApplyAnimationProperties();
          }
        }

        break;
      }
    }
  }
}
