import { createValueGetter } from '../../../math/value-getter';
import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { CurvePropertyClipPlayable } from '../playables/curve-property-clip-playable';
import type { FixedNumberExpression } from '@galacean/effects-specification';

@effectsClass('CurvePropertyPlayableAsset')
export class CurvePropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: FixedNumberExpression;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new CurvePropertyClipPlayable(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}