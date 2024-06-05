import type { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
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

export interface CalculateItemOptions {
  start: number,
  duration: number,
  looping: boolean,
  endBehavior: number,
  startRotation?: number,
  start3DRotation?: number,
}

/**
 * @since 2.0.0
 * @internal
 */
@effectsClass('ObjectBindingTrack')
export class ObjectBindingTrack extends TrackAsset {
  options: CalculateItemOptions;
  data: spec.EffectsObjectData;

  create (timelineAsset: TimelineAsset): void {
    const boundItem = this.binding as VFXItem;

    this.options = {
      start: boundItem.start,
      duration: boundItem.duration,
      looping: boundItem.endBehavior === spec.ItemEndBehavior.loop,
      endBehavior: boundItem.endBehavior || spec.ItemEndBehavior.destroy,
    };
    this.name = boundItem.name;

    // 添加粒子动画 clip
    if (boundItem.getComponent(ParticleSystem)) {
      const particleTrack = timelineAsset.createTrack(TrackAsset, this, 'ParticleTrack');

      particleTrack.binding = this.binding;
      const particleClip = particleTrack.createClip(ParticleBehaviourPlayableAsset);

      particleClip.start = boundItem.start;
      particleClip.duration = boundItem.duration;
      particleClip.endBehaviour = boundItem.endBehavior as spec.ItemEndBehavior;
    }
  }

  toLocalTime (time: number) {
    let localTime = time - this.options.start;
    const duration = this.options.duration;

    if (localTime - duration > 0.001) {
      if (this.options.endBehavior === spec.END_BEHAVIOR_RESTART) {
        localTime = localTime % duration;
      } else if (this.options.endBehavior === spec.END_BEHAVIOR_FREEZE) {
        localTime = Math.min(duration, localTime);
      }
    }

    return localTime;
  }

  override fromData (data: spec.EffectsObjectData): void {
    super.fromData(data);
    this.data = data;
  }
}