import { ItemEndBehavior } from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../decorators';
import type { Engine } from '../../engine';
import { VFXItem } from '../../vfx-item';
import type { PlayableGraph } from '../cal/playable-graph';
import { PlayState, Playable, PlayableAsset, PlayableOutput } from '../cal/playable-graph';
import { ParticleSystem } from '../particle/particle-system';
/**
 * @since 2.0.0
 * @internal
 */
export class TimelineClip {
  id: string;
  name: string;
  start = 0;
  duration = 0;
  asset: PlayableAsset;
  endBehaviour: ItemEndBehavior;

  constructor () {

  }

  toLocalTime (time: number) {
    let localTime = time - this.start;
    const duration = this.duration;

    if (localTime - duration > 0.001) {
      if (this.endBehaviour === ItemEndBehavior.loop) {
        localTime = localTime % duration;
      } else if (this.endBehaviour === ItemEndBehavior.freeze) {
        localTime = Math.min(duration, localTime);
      }
    }

    return localTime;
  }
}

/**
 * @since 2.0.0
 * @internal
 */
@effectsClass('TrackAsset')
export class TrackAsset extends PlayableAsset {
  name: string;
  binding: object;

  trackType = TrackType.MasterTrack;
  private clipSeed = 0;
  @serialize(TimelineClip)
  private clips: TimelineClip[] = [];
  @serialize()
  protected children: TrackAsset[] = [];

  /**
   * 重写该方法以获取自定义对象绑定
   */
  resolveBinding (parentBinding: object): object {
    return parentBinding;
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
  }

  createClip<T extends PlayableAsset> (
    classConstructor: new (engine: Engine) => T,
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

  constructor (clip: TimelineClip, clipPlayable: Playable, parentMixer: Playable, track: TrackAsset) {
    this.clip = clip;
    this.playable = clipPlayable;
    this.parentMixer = parentMixer;
    this.track = track;
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
    const boundItem = this.track.binding as VFXItem;

    if (localTime > clip.start + clip.duration + 0.001 && clip.endBehaviour === ItemEndBehavior.destroy) {
      if (VFXItem.isParticle(boundItem) && !boundItem.getComponent(ParticleSystem)?.destroyed) {
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

    // 判断动画是否结束
    if (ended && !boundItem.ended) {
      boundItem.ended = true;
      boundItem.onEnd();
    }
    if (ended && this.playable.getPlayState() === PlayState.Playing) {
      this.playable.pause();
      this.onClipEnd();
    }
    const clipTime = clip.toLocalTime(localTime);

    this.playable.setTime(clipTime);
  }

  private onClipEnd () {
    const boundItem = this.track.binding as VFXItem;

    if (!boundItem.compositionReusable && !boundItem.reusable) {
      boundItem.dispose();
      this.playable.dispose();

      return;
    }
  }
}

/**
 * @since 2.0.0
 * @internal
 */
export interface TimelineClipData {
  asset: PlayableAsset,
}