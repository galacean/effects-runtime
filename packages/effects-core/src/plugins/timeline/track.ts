import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../decorators';
import { PlayState, Playable, PlayableAsset, PlayableOutput } from './playable';
import type { Constructor } from '../../utils';
import { TrackMixerPlayable } from './playables';

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
  updateAnimatedObject (boundObject: object): object {
    return boundObject;
  }

  /**
   * 重写该方法以创建自定义混合器
   */
  createTrackMixer (): TrackMixerPlayable {
    return new TrackMixerPlayable();
  }

  createOutput (): PlayableOutput {
    const output = new PlayableOutput();

    return output;
  }

  createPlayableGraph (runtimeClips: RuntimeClip[]) {
    const mixerPlayable = this.createMixerPlayableGraph(runtimeClips);

    return mixerPlayable;
  }

  createMixerPlayableGraph (runtimeClips: RuntimeClip[]) {
    const clips: TimelineClip[] = [];

    for (const clip of this.clips) {
      clips.push(clip);
    }
    const mixerPlayable = this.compileClips(clips, runtimeClips);

    return mixerPlayable;
  }

  compileClips (timelineClips: TimelineClip[], runtimeClips: RuntimeClip[]) {
    const mixer = this.createTrackMixer();

    for (const timelineClip of timelineClips) {
      const clipPlayable = this.createClipPlayable(timelineClip);

      clipPlayable.setDuration(timelineClip.duration);

      const clip = new RuntimeClip(timelineClip, clipPlayable, mixer);

      runtimeClips.push(clip);

      mixer.clipPlayables.push(clipPlayable);
      mixer.setClipWeight(clipPlayable, 0.0);
    }

    return mixer;
  }

  override createPlayable (): Playable {
    return new Playable();
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

  private createClipPlayable (clip: TimelineClip) {
    return clip.asset.createPlayable();
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
  parentMixer: TrackMixerPlayable;

  constructor (clip: TimelineClip, clipPlayable: Playable, parentMixer: TrackMixerPlayable) {
    this.clip = clip;
    this.playable = clipPlayable;
    this.parentMixer = parentMixer;
  }

  set enable (value: boolean) {
    if (value) {
      this.playable.play();
    } else {
      this.parentMixer.setClipWeight(this.playable, 0);
      this.playable.pause();
    }
  }

  evaluateAt (localTime: number) {
    const clip = this.clip;

    let weight = 1.0;
    let ended = false;
    let started = false;

    if (localTime >= clip.start + clip.duration && clip.endBehavior === spec.EndBehavior.destroy) {
      weight = 0.0;
      ended = true;
    } else if (localTime - this.clip.start >= 0) {
      weight = 1.0;
      started = true;
    } else if (localTime < clip.start) {
      weight = 0.0;
    }

    if (started && this.playable.getPlayState() !== PlayState.Playing) {
      this.playable.play();
    }
    this.parentMixer.setClipWeight(this.playable, weight);

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
