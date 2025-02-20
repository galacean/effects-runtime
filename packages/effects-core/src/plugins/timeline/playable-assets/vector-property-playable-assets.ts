import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { Vector2, Vector4 } from '@galacean/effects-math/es/core';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.Vector4PropertyPlayableAsset)
export class Vector4PropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: spec.Vector4CurveValue;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new PropertyClipPlayable<Vector4>(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}

@effectsClass(spec.DataType.Vector2PropertyPlayableAsset)
export class Vector2PropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: spec.Vector2CurveValue;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new PropertyClipPlayable<Vector2>(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
