import type { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { ParticleSystem } from '../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../particle/particle-vfx-item';
import { ActivationPlayableAsset } from './calculate-vfx-item';
import { TrackAsset } from '../timeline/track';
import { ActivationTrack } from '../timeline/tracks/activation-track';

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

  private trackSeed = 0;

  create (): void {
    this.options = {
      start: this.binding.start,
      duration: this.binding.duration,
      looping: this.binding.endBehavior === spec.ItemEndBehavior.loop,
      endBehavior: this.binding.endBehavior || spec.ItemEndBehavior.destroy,
    };
    this.id = this.binding.id;
    this.name = this.binding.name;
    const activationTrack = this.createTrack(ActivationTrack, 'ActivationTrack');

    activationTrack.binding = this.binding;
    activationTrack.createClip(ActivationPlayableAsset, 'ActivationTimelineClip');

    // 添加粒子动画 clip
    if (this.binding.getComponent(ParticleSystem)) {
      const particleTrack = this.createTrack(TrackAsset, 'ParticleTrack');

      particleTrack.binding = this.binding;
      particleTrack.createClip(ParticleBehaviourPlayableAsset);
    }

    // TODO TimelineClip 需要传入 start 和 duration 数据
    for (const track of this.children) {
      for (const clip of track.getClips()) {
        clip.start = this.binding.start;
        clip.duration = this.binding.duration;
        clip.endBehaviour = this.binding.endBehavior as spec.ItemEndBehavior;
      }
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

  createTrack<T extends TrackAsset> (classConstructor: new (engine: Engine) => T, name?: string): T {
    const newTrack = new classConstructor(this.engine);

    newTrack.binding = this.binding;
    newTrack.id = (this.trackSeed++).toString();
    newTrack.name = name ? name : 'Track' + newTrack.id;
    this.children.push(newTrack);

    return newTrack;
  }

  getTracks (): TrackAsset[] {
    return this.children;
  }

  findTrack (name: string): TrackAsset | undefined {
    for (const track of this.children) {
      if (track.name === name) {
        return track;
      }
    }
  }

  override fromData (data: spec.EffectsObjectData): void {
    super.fromData(data);
    this.data = data;
  }
}