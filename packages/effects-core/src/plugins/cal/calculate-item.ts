import * as spec from '@galacean/effects-specification';
import type { Euler } from '@galacean/effects-math/es/core/euler';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { effectsClass } from '../../decorators';
import type { ValueGetter } from '../../math';
import { VFXItem } from '../../vfx-item';
import { ParticleSystem } from '../particle/particle-system';
import { ParticleBehaviourPlayableAsset } from '../particle/particle-vfx-item';
import { ActivationTrack, ParticleTrack, TrackAsset } from '../timeline';
import type { TimelineAsset } from '../timeline';
import { SpriteComponent, SpriteTimePlayableAsset, SpriteTimeTrack } from '../sprite/sprite-item';

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

  override updateAnimatedObject (): void {
  }

  create (timelineAsset: TimelineAsset): void {
    if (!(this.boundObject instanceof VFXItem)) {
      return;
    }

    const boundItem = this.boundObject;

    let hasActiveTrack = false;

    for (const childTrack of this.getChildTracks()) {
      if (childTrack instanceof ActivationTrack) {
        hasActiveTrack = true;

        break;
      }
    }

    if (!hasActiveTrack) {
      return;
    }

    // 添加粒子动画 clip // TODO 待移除
    if (boundItem.getComponent(ParticleSystem)) {
      const particleTrack = timelineAsset.createTrack(ParticleTrack, this, 'ParticleTrack');

      particleTrack.boundObject = this.boundObject;
      const particleClip = particleTrack.createClip(ParticleBehaviourPlayableAsset);

      particleClip.start = boundItem.start;
      particleClip.duration = boundItem.duration;
      particleClip.endBehavior = boundItem.endBehavior;
    }

    // 添加图层帧动画动画时间 clip // TODO 待移除
    if (boundItem.getComponent(SpriteComponent)) {
      const spriteAnimationTimeTrack = timelineAsset.createTrack(SpriteTimeTrack, this, 'SpriteTimeTrack');

      spriteAnimationTimeTrack.boundObject = this.boundObject.getComponent(SpriteComponent);
      const clip = spriteAnimationTimeTrack.createClip(SpriteTimePlayableAsset);

      clip.start = boundItem.start;
      clip.duration = boundItem.duration;
      clip.endBehavior = boundItem.endBehavior;
    }
  }
}
