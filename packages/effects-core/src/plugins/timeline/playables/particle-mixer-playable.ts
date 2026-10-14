import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ParticleMixerPlayable extends TrackMixerPlayable {

  override evaluate (boundObject: object, context: FrameContext): void {
  }
}
