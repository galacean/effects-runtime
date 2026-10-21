import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import { ParticleBehaviourPlayableAsset } from '../../particle/particle-vfx-item';
import { ComponentTimePlayableAsset, EffectComponentTimeTrack, SpriteComponentTimeTrack } from '../../sprite/sprite-item';
import { TrackAsset } from '../track';
import type { TimelineClip } from '../timeline-clip';
import type { Constructor } from '../../../utils';
import { ActivationTrack } from './activation-track';
import { ParticleTrack } from './particle-track';

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.ObjectBindingTrack)
export class ObjectBindingTrack extends TrackAsset {

  /** Compile a fixed compatibility graph; missing target components resolve to no object. @internal */
  createCompatibilityTracks (): TrackAsset[] {
    const activationClips = this.getChildTracks().find(track => track instanceof ActivationTrack)?.getClips() ?? [];
    const tracks: TrackAsset[] = [];

    if (activationClips.length === 0) {
      return tracks;
    }
    this.addCompatibilityTrack(tracks, ParticleTrack, ParticleBehaviourPlayableAsset, activationClips);
    this.addCompatibilityTrack(tracks, SpriteComponentTimeTrack, ComponentTimePlayableAsset, activationClips);
    this.addCompatibilityTrack(tracks, EffectComponentTimeTrack, ComponentTimePlayableAsset, activationClips);

    return tracks;
  }

  private addCompatibilityTrack (
    tracks: TrackAsset[],
    trackClass: Constructor<TrackAsset>,
    clipClass: Constructor<TimelineClip>,
    activationClips: TimelineClip[],
  ): void {
    if (this.getChildTracks().some(child => child instanceof trackClass)) {
      return;
    }
    const track = new trackClass(this.engine);

    track.unregisterObject();
    track.name = trackClass.name;
    track.parent = this;
    for (const source of activationClips) {
      const clip = track.createClip(clipClass);

      clip.unregisterObject();
      clip.start = source.start;
      clip.duration = source.duration;
      clip.endBehavior = source.endBehavior;
    }
    tracks.push(track);
  }
}
