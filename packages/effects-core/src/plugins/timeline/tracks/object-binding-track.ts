import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { VFXItem } from '../../../vfx-item';
import { ParticleSystem } from '../../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../../particle/particle-vfx-item';
import { SpriteComponent, ComponentTimePlayableAsset, EffectComponentTimeTrack, SpriteComponentTimeTrack } from '../../sprite/sprite-item';
import { EffectComponent } from '../../../components';
import { TrackAsset } from '../track';
import type { TimelineClip } from '../track';
import type { PlayableAsset } from '../playable';
import type { TimelineAsset } from '../timeline-asset';
import type { Constructor } from '../../../utils';
import { ActivationTrack } from './activation-track';
import { ParticleTrack } from './particle-track';

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.ObjectBindingTrack)
export class ObjectBindingTrack extends TrackAsset {

  create (timelineAsset: TimelineAsset, sceneBindingMap: Record<string, VFXItem>): void {
    const boundItem = sceneBindingMap[this.getInstanceId()];

    if (!boundItem) {
      return;
    }

    const activationClips = this.getChildTracks().find(track => track instanceof ActivationTrack)?.getClips() ?? [];

    // Synchronize compatibility clips without appending tracks on each rebuild.
    if (boundItem.getComponent(ParticleSystem)) {
      this.syncTrack(timelineAsset, ParticleTrack, ParticleBehaviourPlayableAsset, activationClips);
    }
    if (boundItem.getComponent(SpriteComponent)) {
      this.syncTrack(timelineAsset, SpriteComponentTimeTrack, ComponentTimePlayableAsset, activationClips);
    }
    if (boundItem.getComponent(EffectComponent)) {
      this.syncTrack(timelineAsset, EffectComponentTimeTrack, ComponentTimePlayableAsset, activationClips);
    }
  }

  private syncTrack (
    timelineAsset: TimelineAsset,
    trackClass: Constructor<TrackAsset>,
    playableClass: Constructor<PlayableAsset>,
    activationClips: TimelineClip[],
  ): void {
    let track = this.getChildTracks().find(child => child instanceof trackClass);

    if (!track) {
      if (activationClips.length === 0) {
        return;
      }
      track = timelineAsset.createTrack(trackClass, this, trackClass.name);
    }
    const clips = track.getClips();

    while (clips.length > activationClips.length) {
      clips.pop()!.asset.dispose();
    }
    for (let i = 0; i < activationClips.length; i++) {
      const source = activationClips[i];
      const clip = clips[i] ?? track.createClip(playableClass);

      clip.start = source.start;
      clip.duration = source.duration;
      clip.endBehavior = source.endBehavior;
    }
  }
}
