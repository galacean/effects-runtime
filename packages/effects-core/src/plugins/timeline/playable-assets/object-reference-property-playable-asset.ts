import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import { PropertyClipPlayable } from '../playables';
import { ReferenceCurve } from '../../../math';
import type { EffectsObject } from '../../../effects-object';

/** Samples object references without interpolation. */
@effectsClass(spec.DataType.ObjectReferencePropertyPlayableAsset)
export class ObjectReferencePropertyPlayableAsset extends TimelineClip {
  curve: ReferenceCurve<EffectsObject | null>;

  override fromData (data: spec.ObjectReferencePropertyPlayableAssetData): void {
    super.fromData(data);
    const items = data.curveData[1];
    const referenceCurveData: [number, EffectsObject | null][] = [];

    for (let i = 0; i < items.length; i++) {
      const [t, ref] = items[i];

      referenceCurveData.push([t, ref === null ? null : this.findObject<EffectsObject>(ref)]);
    }
    this.curve = new ReferenceCurve(referenceCurveData);
  }

  override createPlayable (): ClipPlayable {
    const clip = new PropertyClipPlayable<EffectsObject | null>();

    clip.curve = this.curve;
    clip.value = clip.curve.getValue(0);

    return clip;
  }
}
