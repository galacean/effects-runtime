import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import type { TimelineClipData } from '../timeline-clip';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { ValueGetter } from '../../../math';
import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';

/** TODO: update to spec. */
interface ColorPropertyPlayableAssetData extends TimelineClipData {
  dataType: spec.DataType.ColorPropertyPlayableAsset,
  curveData: spec.ColorCurveValue,
}

@effectsClass(spec.DataType.ColorPropertyPlayableAsset)
export class ColorPropertyPlayableAsset extends TimelineClip {
  curve: ValueGetter<Color>;

  override fromData (data: ColorPropertyPlayableAssetData): void {
    super.fromData(data);
    this.curve = createValueGetter(data.curveData);
  }

  override createPlayable (): ClipPlayable {
    const clipPlayable = new PropertyClipPlayable<Color>();

    clipPlayable.curve = this.curve;
    clipPlayable.value = clipPlayable.curve.getValue(0, new Color());

    return clipPlayable;
  }
}
