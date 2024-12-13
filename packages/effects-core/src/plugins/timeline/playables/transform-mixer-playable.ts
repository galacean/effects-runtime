import type { FrameContext } from '../../cal/playable-graph';
import { TrackMixerPlayable } from './track-mixer-playable';

export class TransformMixerPlayable extends TrackMixerPlayable {

  override evaluate (context: FrameContext): void {
  }
}
