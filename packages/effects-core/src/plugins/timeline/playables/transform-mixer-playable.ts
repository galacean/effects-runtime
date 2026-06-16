import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class TransformMixerPlayable extends TrackMixerPlayable {

  override evaluate (context: FrameContext): void {
  }
}
