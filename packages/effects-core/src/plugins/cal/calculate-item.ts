import * as spec from '@galacean/effects-specification';
import type { Euler } from '@galacean/effects-math/es/core/euler';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { effectsClass } from '../../decorators';
import type { ValueGetter } from '../../math';
import { VFXItem } from '../../vfx-item';
import { ParticleSystem } from '../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../particle/particle-vfx-item';
import { TrackAsset } from '../timeline';
import type { TimelineAsset } from '../timeline';

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
 */
@effectsClass(spec.DataType.ObjectBindingTrack)
export class ObjectBindingTrack extends TrackAsset {

  create (timelineAsset: TimelineAsset): void {
    if (!(this.boundObject instanceof VFXItem)) {
      return;
    }

    const boundItem = this.boundObject;

    // 添加粒子动画 clip // TODO 待移除
    if (boundItem.getComponent(ParticleSystem)) {
      const particleTrack = timelineAsset.createTrack(TrackAsset, this, 'ParticleTrack');

      particleTrack.boundObject = this.boundObject;
      const particleClip = particleTrack.createClip(ParticleBehaviourPlayableAsset);

      particleClip.start = boundItem.start;
      particleClip.duration = boundItem.duration;
      particleClip.endBehavior = boundItem.endBehavior;
    }
  }
}
