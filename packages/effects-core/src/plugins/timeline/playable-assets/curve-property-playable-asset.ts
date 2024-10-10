import { effectsClass, serialize } from 'packages/effects-core/src/decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { CurvePropertyClipPlayable } from '../playables/curve-property-clip-playable';
import type { FixedNumberExpression } from '@galacean/effects-specification';
import { createValueGetter } from 'packages/effects-core/src/math';

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