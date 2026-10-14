import * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import type { Playable, PlayableAsset } from './playable';
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
export class TrackAsset extends Asset {
  name: string;
  parent: TrackAsset;

  private clipSeed = 0;

  private clips: TimelineClip[] = [];

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

  createPlayableGraph () {
    return this.createMixerPlayableGraph();
  }

  createMixerPlayableGraph () {
    return this.compileClips(this.clips);
  }

  compileClips (timelineClips: TimelineClip[]) {
    const mixer = this.createTrackMixer();

    mixer.sourceTrack = this;
    mixer.objectBindingId = this.getInstanceId();

    for (const timelineClip of timelineClips) {
      const clipPlayable = this.createClipPlayable(timelineClip);

      clipPlayable.setDuration(timelineClip.duration);

      const clip = new RuntimeClip(timelineClip, clipPlayable, mixer);

      mixer.addRuntimeClip(clip);
    }

    return mixer;
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

  addClip (clip: TimelineClip): void {
    clip.id = (this.clipSeed++).toString();
    this.clips.push(clip);
  }

  private createClipPlayable (clip: TimelineClip) {
    return clip.asset.createPlayable();
  }

  override fromData (data: spec.TrackAssetData): void {
    super.fromData(data);

    if (data.clips !== undefined) {
      this.clips = data.clips.map(clipData => {
        const clip = new TimelineClip();

        if (clipData.start !== undefined) { clip.start = clipData.start; }
        if (clipData.duration !== undefined) { clip.duration = clipData.duration; }
        if (clipData.endBehavior !== undefined) { clip.endBehavior = clipData.endBehavior; }
        clip.asset = this.findObject<PlayableAsset>(clipData.asset);

        return clip;
      });
    }
    if (data.children !== undefined) {
      this.children = data.children.map(child => this.findObject<TrackAsset>(child));
    }
    for (const child of this.children) {
      child.parent = this;
    }
  }
}

export class RuntimeClip {
  active = false;
  clip: TimelineClip;
  playable: Playable;
  parentMixer: TrackMixerPlayable;

  constructor (clip: TimelineClip, clipPlayable: Playable, parentMixer: TrackMixerPlayable) {
    this.clip = clip;
    this.playable = clipPlayable;
    this.parentMixer = parentMixer;
  }

  evaluateAt (localTime: number) {
    const clip = this.clip;
    const ended = localTime >= clip.start + clip.duration && clip.endBehavior === spec.EndBehavior.destroy;

    this.active = localTime >= clip.start && !ended;

    if (this.active) {
      this.playable.play();
    } else if (ended) {
      this.playable.pause();
    }
    this.parentMixer.setClipWeight(this.playable, this.active ? 1 : 0);
    this.playable.setTime(clip.toLocalTime(localTime));
  }
}
