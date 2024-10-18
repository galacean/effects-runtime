import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { PropertyClipPlayable } from '../playables';
import type { Vector4CurveData } from '../../../math';
import { createValueGetter } from '../../../math';
import type { Vector4 } from '@galacean/effects-math/es/core';

@effectsClass('Vector4PropertyPlayableAsset')
export class Vector4PropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: Vector4CurveData;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new PropertyClipPlayable<Vector4>(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
