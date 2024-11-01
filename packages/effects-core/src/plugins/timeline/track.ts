import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../decorators';
import { VFXItem } from '../../vfx-item';
import type { PlayableGraph } from '../cal/playable-graph';
import { PlayState, Playable, PlayableAsset, PlayableOutput } from '../cal/playable-graph';
import { ParticleSystem } from '../particle/particle-system';
import type { Constructor } from '../../utils';

/**
 * @since 2.0.0
 */
export class TimelineClip {
  id: string;
  name: string;
  start = 0;
  duration = 0;
  asset: PlayableAsset;
  endBehavior: spec.EndBehavior;

  constructor () {
  }

  toLocalTime (time: number) {
    let localTime = time - this.start;
    const duration = this.duration;

    if (localTime - duration > 0) {
      if (this.endBehavior === spec.EndBehavior.restart) {
        localTime = localTime % duration;
      } else if (this.endBehavior === spec.EndBehavior.freeze) {
        localTime = Math.min(duration, localTime);
      }
    }

    return localTime;
  }
}

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.TrackAsset)
export class TrackAsset extends PlayableAsset {
  name: string;
  boundObject: object;
  parent: TrackAsset;
  trackType = TrackType.MasterTrack;

  private clipSeed = 0;

  @serialize(TimelineClip)
  private clips: TimelineClip[] = [];

  @serialize()
  protected children: TrackAsset[] = [];

  /**
   * 重写该方法以获取自定义对象绑定
   */
  updateAnimatedObject () {
    if (this.parent) {
      this.boundObject = this.parent.boundObject;
    }
  }

  /**
   * 重写该方法以创建自定义混合器
   */
  createTrackMixer (graph: PlayableGraph): Playable {
    return new Playable(graph);
  }

  createOutput (): PlayableOutput {
    const output = new PlayableOutput();

    return output;
  }

  createPlayableGraph (graph: PlayableGraph, runtimeClips: RuntimeClip[]) {
    const mixerPlayable = this.createMixerPlayableGraph(graph, runtimeClips);

    return mixerPlayable;
  }

  createMixerPlayableGraph (graph: PlayableGraph, runtimeClips: RuntimeClip[]) {
    const clips: TimelineClip[] = [];

    for (const clip of this.clips) {
      clips.push(clip);
    }
    const mixerPlayable = this.compileClips(graph, clips, runtimeClips);

    return mixerPlayable;
  }

  compileClips (graph: PlayableGraph, timelineClips: TimelineClip[], runtimeClips: RuntimeClip[]) {
    const mixer = this.createTrackMixer(graph);

    for (const timelineClip of timelineClips) {
      const clipPlayable = this.createClipPlayable(graph, timelineClip);

      clipPlayable.setDuration(timelineClip.duration);

      const clip = new RuntimeClip(timelineClip, clipPlayable, mixer, this);

      runtimeClips.push(clip);

      mixer.addInput(clipPlayable, 0);
      mixer.setInputWeight(clipPlayable, 0.0);
    }

    return mixer;
  }

  override createPlayable (graph: PlayableGraph): Playable {
    return new Playable(graph);
  }

  getChildTracks () {
    return this.children;
  }

  addChild (child: TrackAsset) {
    this.children.push(child);
    child.parent = this;
  }

  createClip<T extends PlayableAsset> (
    classConstructor: Constructor<T>,
    name?: string,
  ): TimelineClip {
    const newClip = new TimelineClip();

    newClip.asset = new classConstructor(this.engine);
    newClip.name = name ? name : 'TimelineClip' + newClip.id;
    this.addClip(newClip);

    return newClip;
  }

  getClips (): TimelineClip[] {
    return this.clips;
  }

  findClip (name: string): TimelineClip | undefined {
    for (const clip of this.clips) {
      if (clip.name === name) {
        return clip;
      }
    }
  }

  addClip (clip: TimelineClip): void {
    clip.id = (this.clipSeed++).toString();
    this.clips.push(clip);
  }

  private createClipPlayable (graph: PlayableGraph, clip: TimelineClip) {
    return clip.asset.createPlayable(graph);
  }

  override fromData (data: spec.EffectsObjectData): void {
    super.fromData(data);
    for (const child of this.children) {
      child.parent = this;
    }
  }
}

export enum TrackType {
  MasterTrack,
  ObjectTrack,
}

export class RuntimeClip {
  clip: TimelineClip;
  playable: Playable;
  parentMixer: Playable;
  track: TrackAsset;

  // TODO: 粒子结束行为有特殊逻辑，这里 cache 一下避免每帧查询组件导致 GC。粒子结束行为判断统一后可移除
  particleSystem: ParticleSystem;

  constructor (clip: TimelineClip, clipPlayable: Playable, parentMixer: Playable, track: TrackAsset) {
    this.clip = clip;
    this.playable = clipPlayable;
    this.parentMixer = parentMixer;
    this.track = track;

    if (this.track.boundObject instanceof VFXItem) {
      this.particleSystem = this.track.boundObject.getComponent(ParticleSystem);
    }
  }

  set enable (value: boolean) {
    if (value) {
      this.playable.play();
    } else {
      this.parentMixer.setInputWeight(this.playable, 0);
      this.playable.pause();
    }
  }

  evaluateAt (localTime: number) {
    const clip = this.clip;

    let weight = 1.0;
    let ended = false;
    let started = false;
    const boundObject = this.track.boundObject;

    if (localTime >= clip.start + clip.duration && clip.endBehavior === spec.EndBehavior.destroy) {
      if (boundObject instanceof VFXItem && VFXItem.isParticle(boundObject) && this.particleSystem && !this.particleSystem.destroyed) {
        weight = 1.0;
      } else {
        weight = 0.0;
        ended = true;
      }
    } else if (localTime - this.clip.start >= 0) {
      weight = 1.0;
      started = true;
    } else if (localTime < clip.start) {
      weight = 0.0;
    }

    if (started && this.playable.getPlayState() !== PlayState.Playing) {
      this.playable.play();
    }
    this.parentMixer.setInputWeight(this.playable, weight);

    const clipTime = clip.toLocalTime(localTime);

    this.playable.setTime(clipTime);

    // 判断动画是否结束
    if (ended) {
      if (this.playable.getPlayState() === PlayState.Playing) {
        this.playable.pause();
      }
    }
  }
}

/**
 * @since 2.0.0
 */
export interface TimelineClipData {
  asset: PlayableAsset,
}
