import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import type { TimelineClipData } from '../timeline-clip';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { ValueGetter } from '../../../math';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.FloatPropertyPlayableAsset)
export class FloatPropertyPlayableAsset extends TimelineClip {
  curve: ValueGetter<number>;

  override fromData (data: spec.FloatPropertyPlayableAssetData & TimelineClipData): void {
    super.fromData(data);
    this.curve = createValueGetter(data.curveData);
  }

  override createPlayable (): ClipPlayable {
    const clipPlayable = new PropertyClipPlayable();

    clipPlayable.curve = this.curve;
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
