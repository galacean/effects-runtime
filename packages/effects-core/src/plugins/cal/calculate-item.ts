import type { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { serialize } from '../../decorators';
import type { ValueGetter } from '../../math';
import { VFXItem } from '../../vfx-item';
import { SpriteColorPlayable } from '../sprite/sprite-item';
import { ActivationPlayable, AnimationClipPlayable, TransformAnimationPlayable } from './calculate-vfx-item';
import { PlayableGraph } from './playable-graph';
import { Track } from './track';

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
export class ObjectBindingTrack extends Track {
  reusable = false;
  started = false;
  playableGraph = new PlayableGraph();
  options: CalculateItemOptions;

  /**
   * 元素动画已经播放的时间
   */
  @serialize()
  private time = 0;
  private tracks: Track[] = [];
  private trackSeed = 0;

  create (): void {
    // TODO TimelineClip 需要传入 start 和 duration 数据
    for (const track of this.tracks) {
      for (const clip of track.getClips()) {
        clip.start = this.bindingItem.start;
        clip.duration = this.bindingItem.duration;
      }
    }
    this.compileTracks(this.playableGraph);
  }

  // TODO: [1.31] @十弦 vfx-item 下 onUpdate 的改动验证
  update (dt: number): void {
    if (this.bindingItem.stopped || !this.bindingItem.composition) {
      return;
    }

    if (!this.started) {
      for (const track of this.tracks) {
        for (const clip of track.getClips()) {
          clip.playable.onGraphStart();
        }
      }
      this.started = true;
    }

    const now = this.time;

    // 判断动画是否开始
    if (this.bindingItem.delaying && now >= 0 && now <= this.bindingItem.duration) {
      this.bindingItem.delaying = false;
      for (const track of this.tracks) {
        for (const clip of track.getClips()) {
          clip.playable.onPlayablePlay();
        }
      }
    }

    // 判断动画是否结束
    let ended;

    if (VFXItem.isParticle(this.bindingItem)) {
      ended = this.bindingItem.isEnded(now) && this.bindingItem.content.destoryed;
    } else {
      ended = this.bindingItem.isEnded(now);
    }

    if (ended) {
      const endBehavior = this.bindingItem.endBehavior;

      if (!this.bindingItem.ended) {
        this.bindingItem.ended = true;
        this.bindingItem.onEnd();

        if (endBehavior === spec.ItemEndBehavior.destroy) {
          for (const track of this.tracks) {
            for (const clip of track.getClips()) {
              clip.playable.onPlayableDestroy();
            }
          }
          this.bindingItem.delaying = true;
          if (!this.bindingItem.reusable && !this.reusable) {
            this.bindingItem.dispose();

            return;
          }
        }
      }
    }

    // TODO: [1.31] @茂安 验证 https://github.com/galacean/effects-runtime/commits/main/packages/effects-core/src/vfx-item.ts
    // 在生命周期内更新动画
    if (!this.bindingItem.delaying) {
      const lifetime = this.time / this.bindingItem.duration;

      this.bindingItem.lifetime = lifetime;
      for (const track of this.tracks) {
        for (const clip of track.getClips()) {
          clip.playable.setTime(this.time);
        }
      }
      this.playableGraph.evaluate(dt);
    }
  }

  // time 单位秒
  setTime (time: number) {
    this.time = time;
  }

  getTime () {
    return this.time;
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

  createTrack<T extends Track> (classConstructor: new () => T, name?: string): T {
    const newTrack = new classConstructor();

    newTrack.bindingItem = this.bindingItem;
    newTrack.id = (this.trackSeed++).toString();
    newTrack.name = name ? name : 'Track' + newTrack.id;
    this.tracks.push(newTrack);

    return newTrack;
  }

  getTracks (): Track[] {
    return this.tracks;
  }

  findTrack (name: string): Track | undefined {
    for (const track of this.tracks) {
      if (track.name === name) {
        return track;
      }
    }
  }

  rebuildGraph () {
    this.playableGraph = new PlayableGraph();
    this.compileTracks(this.playableGraph);
  }

  compileTracks (graph: PlayableGraph) {
    for (const track of this.tracks) {
      const trackMixPlayable = track.createPlayable();
      const trackOutput = track.createOutput();

      graph.addOutput(trackOutput);

      trackOutput.setSourcePlayeble(trackMixPlayable);
    }
  }

  override fromData (data: spec.NullContent): void {
    super.fromData(data);

    this.options = {
      start: this.bindingItem.start,
      duration: this.bindingItem.duration,
      looping: this.bindingItem.endBehavior === spec.ItemEndBehavior.loop,
      endBehavior: this.bindingItem.endBehavior || spec.ItemEndBehavior.destroy,
    };
    this.id = this.bindingItem.id;
    this.name = this.bindingItem.name;
    const activationTrack = this.createTrack(Track, 'ActivationTrack');

    activationTrack.createClip(ActivationPlayable, 'ActivationTimelineClip');

    //@ts-expect-error
    if (data.tracks) {
      //@ts-expect-error
      const tracks = data.tracks;

      for (const track of tracks) {
        const newTrack = this.createTrack(Track);

        for (const clipAsset of track.clips) {
          switch (clipAsset.dataType) {
            case 'TransformAnimationPlayableAsset':
              newTrack.name = 'TransformAnimationTrack';
              newTrack.createClip(TransformAnimationPlayable, 'TransformAnimationTimelineClip').playable.fromData(clipAsset.animationClip);

              break;
            case 'SpriteColorAnimationPlayableAsset':
              newTrack.name = 'SpriteColorTrack';
              newTrack.createClip(SpriteColorPlayable, 'SpriteColorClip').playable.fromData(clipAsset.animationClip);

              break;
            case 'AnimationClipPlayableAsset':
              newTrack.name = 'AnimationTrack';
              newTrack.createClip(AnimationClipPlayable, 'AnimationTimelineClip').playable.fromData(clipAsset.animationClip);

              break;
          }

        }
      }
    }
  }
}
