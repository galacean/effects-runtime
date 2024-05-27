import type { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { ParticleSystem } from '../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../particle/particle-vfx-item';
import { ActivationPlayableAsset } from './calculate-vfx-item';
import { TrackAsset } from './track';

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
      start: this.bindingItem.start,
      duration: this.bindingItem.duration,
      looping: this.bindingItem.endBehavior === spec.ItemEndBehavior.loop,
      endBehavior: this.bindingItem.endBehavior || spec.ItemEndBehavior.destroy,
    };
    this.id = this.bindingItem.id;
    this.name = this.bindingItem.name;
    const activationTrack = this.createTrack(TrackAsset, 'ActivationTrack');

    activationTrack.bindingItem = this.bindingItem;
    activationTrack.createClip(ActivationPlayableAsset, 'ActivationTimelineClip');

    // 添加粒子动画 clip
    if (this.bindingItem.getComponent(ParticleSystem)) {
      const particleTrack = this.createTrack(TrackAsset, 'ParticleTrack');

      particleTrack.bindingItem = this.bindingItem;
      particleTrack.createClip(ParticleBehaviourPlayableAsset);
    }

    // TODO TimelineClip 需要传入 start 和 duration 数据
    for (const track of this.children) {
      for (const clip of track.getClips()) {
        clip.start = this.bindingItem.start;
        clip.duration = this.bindingItem.duration;
        clip.endBehaviour = this.bindingItem.endBehavior as spec.ItemEndBehavior;
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

    newTrack.bindingItem = this.bindingItem;
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