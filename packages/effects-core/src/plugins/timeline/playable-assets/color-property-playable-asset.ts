import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { ValueGetter } from '../../../math';
import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.ColorPropertyPlayableAsset)
export class ColorPropertyPlayableAsset extends PlayableAsset {
  curve: ValueGetter<Color>;

  override fromData (data: spec.ColorPropertyPlayableAssetData): void {
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
