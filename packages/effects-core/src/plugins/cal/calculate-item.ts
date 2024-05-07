import * as spec from '@galacean/effects-specification';
import type { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import { ItemBehaviour } from '../../components';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { VFXItem } from '../../vfx-item';
import { PlayableGraph } from './playable-graph';
import { Track } from './track';
import { serialize } from '../../decorators';
import { ActivationPlayable, TransformAnimationPlayable } from './calculate-vfx-item';
import { SpriteColorPlayable } from '../sprite/sprite-item';

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
export class TimelineComponent extends ItemBehaviour {
  id: string;
  reusable = false;
  timelineStarted = false;
  playableGraph = new PlayableGraph();
  options: CalculateItemOptions;

  /**
   * 元素动画已经播放的时间
   */
  @serialize()
  private time = 0;
  private tracks: Track[] = [];
  private trackSeed = 0;

  constructor (engine: Engine) {
    super(engine);
  }

  override start (): void {
    // TODO TimelineClip 需要传入 start 和 duration 数据
    for (const track of this.tracks) {
      for (const clip of track.getClips()) {
        clip.start = this.item.start;
        clip.duration = this.item.duration;
      }
    }
    this.compileTracks(this.playableGraph);
  }

  // TODO: [1.31] @十弦 vfx-item 下 onUpdate 的改动验证
  override update (dt: number): void {
    if (this.item.stopped || !this.item.composition) {
      return;
    }

    if (!this.timelineStarted) {
      for (const track of this.tracks) {
        for (const clip of track.getClips()) {
          clip.playable.onGraphStart();
        }
      }
      this.timelineStarted = true;
    }

    const now = this.time;

    // 判断动画是否开始
    if (this.item.delaying && now >= 0 && now <= this.item.duration) {
      this.item.delaying = false;
      for (const track of this.tracks) {
        for (const clip of track.getClips()) {
          clip.playable.onPlayablePlay();
        }
      }
    }

    // 判断动画是否结束
    let ended;

    if (VFXItem.isParticle(this.item)) {
      ended = this.item.isEnded(now) && this.item.content.destoryed;
    } else {
      ended = this.item.isEnded(now);
    }

    if (ended) {
      const endBehavior = this.item.endBehavior;

      if (!this.item.ended) {
        this.item.ended = true;
        this.item.onEnd();

        if (endBehavior === spec.ItemEndBehavior.destroy) {
          for (const track of this.tracks) {
            for (const clip of track.getClips()) {
              clip.playable.onPlayableDestroy();
            }
          }
          this.item.delaying = true;
          if (!this.item.reusable && !this.reusable) {
            this.item.dispose();

            return;
          }
        }
      }
    }

    // TODO: [1.31] @茂安 验证 https://github.com/galacean/effects-runtime/commits/main/packages/effects-core/src/vfx-item.ts
    // 在生命周期内更新动画
    if (!this.item.delaying) {
      const lifetime = this.time / this.item.duration;

      this.item.lifetime = lifetime;
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

    newTrack.bindingItem = this.item;
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
      start: this.item.start,
      duration: this.item.duration,
      looping: this.item.endBehavior === spec.ItemEndBehavior.loop,
      endBehavior: this.item.endBehavior || spec.ItemEndBehavior.destroy,
    };
    this.id = this.item.id;
    this.name = this.item.name;
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
              newTrack.name = 'AnimationTrack';
              newTrack.createClip(TransformAnimationPlayable, 'AnimationTimelineClip').playable.fromData(clipAsset.animationClip);

              break;
            case 'SpriteColorAnimationPlayableAsset':
              newTrack.name = 'SpriteColorTrack';
              newTrack.createClip(SpriteColorPlayable, 'SpriteColorClip').playable.fromData(clipAsset.animationClip);

              break;
          }

        }
      }
    }
  }

  override toData (): void {
    super.toData();
  }
}
