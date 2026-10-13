import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { ValueGetter } from '../../../math';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.FloatPropertyPlayableAsset)
export class FloatPropertyPlayableAsset extends PlayableAsset {
  curve: ValueGetter<number>;

  override fromData (data: spec.FloatPropertyPlayableAssetData): void {
    super.fromData(data);
    this.curve = createValueGetter(data.curveData);
  }

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable();

    clipPlayable.curve = this.curve;
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
