import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { Playable } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { ActivationPlayable } from '../playables';

@effectsClass(spec.DataType.ActivationPlayableAsset)
export class ActivationPlayableAsset extends PlayableAsset {
  override createPlayable (): Playable {
    return new ActivationPlayable();
  }
}