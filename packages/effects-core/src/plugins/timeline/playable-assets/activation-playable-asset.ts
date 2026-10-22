import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import { ActivationPlayable } from '../playables';

@effectsClass(spec.DataType.ActivationPlayableAsset)
export class ActivationPlayableAsset extends TimelineClip {
  override createPlayable (): ClipPlayable {
    return new ActivationPlayable();
  }
}
