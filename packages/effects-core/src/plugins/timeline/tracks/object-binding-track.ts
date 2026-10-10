import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import { VFXItem } from '../../../vfx-item';
import { ParticleSystem } from '../../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../../particle/particle-vfx-item';
import { SpriteComponent, ComponentTimePlayableAsset, EffectComponentTimeTrack, SpriteComponentTimeTrack } from '../../sprite/sprite-item';
import { EffectComponent } from '../../../components';
import { TrackAsset } from '../track';
import { ActivationTrack } from './activation-track';
import { ParticleTrack } from './particle-track';

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.ObjectBindingTrack)
export class ObjectBindingTrack extends TrackAsset {

  create (sceneBindingMap: Record<string, VFXItem>): TrackAsset[] {
    const tracks: TrackAsset[] = [];
    const boundItem = sceneBindingMap[this.getInstanceId()];

    if (!(boundItem instanceof VFXItem)) {
      return tracks;
    }

    for (const childTrack of this.getChildTracks()) {
      if (childTrack instanceof ActivationTrack) {

        // 添加粒子动画 clip // TODO 待移除
        if (boundItem.getComponent(ParticleSystem)) {
          const particleTrack = new ParticleTrack(this.engine);

          particleTrack.parent = this;
          tracks.push(particleTrack);

          for (const activationClip of childTrack.getClips()) {
            const particleClip = particleTrack.createClip(ParticleBehaviourPlayableAsset);

            particleClip.start = activationClip.start;
            particleClip.duration = activationClip.duration;
            particleClip.endBehavior = activationClip.endBehavior;
          }

        }

        // 添加图层帧动画动画时间 clip // TODO 待移除
        if (boundItem.getComponent(SpriteComponent)) {
          const componentTimeTrack = new SpriteComponentTimeTrack(this.engine);

          componentTimeTrack.parent = this;
          tracks.push(componentTimeTrack);

          for (const activationClip of childTrack.getClips()) {
            const clip = componentTimeTrack.createClip(ComponentTimePlayableAsset);

            clip.start = activationClip.start;
            clip.duration = activationClip.duration;
            clip.endBehavior = activationClip.endBehavior;
          }
        }

        // 添加图层帧动画动画时间 clip // TODO 待移除
        if (boundItem.getComponent(EffectComponent)) {
          const componentTimeTrack = new EffectComponentTimeTrack(this.engine);

          componentTimeTrack.parent = this;
          tracks.push(componentTimeTrack);

          for (const activationClip of childTrack.getClips()) {
            const clip = componentTimeTrack.createClip(ComponentTimePlayableAsset);

            clip.start = activationClip.start;
            clip.duration = activationClip.duration;
            clip.endBehavior = activationClip.endBehavior;
          }
        }

        break;
      }
    }

    return tracks;
  }
}
