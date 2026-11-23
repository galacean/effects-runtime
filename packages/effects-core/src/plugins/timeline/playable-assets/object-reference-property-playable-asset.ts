import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import type { TimelineClipData } from '../timeline-clip';
import { PropertyClipPlayable } from '../playables';
import { ReferenceCurve } from '../../../math';
import type { EffectsObject } from '../../../effects-object';

/**
 * 对象引用曲线序列化值：[REFERENCE_CURVE, [time, DataPath | null][]]。
 * 序列化形态，无泛型。
 * TODO: update to spec.
 */
export type ReferenceCurveValue = [number, [number, spec.DataPath | null][]];

/** TODO: update to spec. */
export interface ObjectReferencePropertyPlayableAssetData extends TimelineClipData {
  curveData: ReferenceCurveValue,
}

/** Samples object references without interpolation. */
@effectsClass('ObjectReferencePropertyPlayableAsset')
export class ObjectReferencePropertyPlayableAsset extends TimelineClip {
  curve: ReferenceCurve<EffectsObject | null>;

  override fromData (data: ObjectReferencePropertyPlayableAssetData): void {
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
