import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { ActivationPlayable } from '../playables';

@effectsClass(spec.DataType.ActivationPlayableAsset)
export class ActivationPlayableAsset extends PlayableAsset {
  override createPlayable (): Playable {
    return new ActivationPlayable();
  }
}