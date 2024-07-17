import type { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import type { ValueGetter } from '../../math';
import type { VFXItem } from '../../vfx-item';
import { ParticleSystem } from '../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../particle/particle-vfx-item';
import { TrackAsset } from '../timeline/track';
import type { TimelineAsset } from './timeline-asset';

/**
 * 基础位移属性数据
 */
export type ItemBasicTransform = {
  position: Vector3,
  rotation: Euler,
  scale: Vector3,
  path?: ValueGetter<Vector3>,
};

export type ItemLinearVelOverLifetime = {
  asMovement?: boolean,
  x?: ValueGetter<number>,
  y?: ValueGetter<number>,
  z?: ValueGetter<number>,
  enabled?: boolean,
};

/**
 * @since 2.0.0
 * @internal
 */
@effectsClass('ObjectBindingTrack')
export class ObjectBindingTrack extends TrackAsset {

  create (timelineAsset: TimelineAsset): void {
    const boundItem = this.binding as VFXItem;

    // 添加粒子动画 clip
    if (boundItem.getComponent(ParticleSystem)) {
      const particleTrack = timelineAsset.createTrack(TrackAsset, this, 'ParticleTrack');

      particleTrack.binding = this.binding;
      const particleClip = particleTrack.createClip(ParticleBehaviourPlayableAsset);

      particleClip.start = boundItem.start;
      particleClip.duration = boundItem.duration;
      particleClip.endBehavior = boundItem.endBehavior as spec.EndBehavior;
    }
  }
}