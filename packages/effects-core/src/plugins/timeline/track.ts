import { ParticleSystem } from '@galacean/effects-core';
import { ItemEndBehavior } from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../decorators';
import type { Engine } from '../../engine';
import { VFXItem } from '../../vfx-item';
import type { PlayableGraph } from '../cal/playable-graph';
import { PlayState, Playable, PlayableAsset, PlayableOutput } from '../cal/playable-graph';

/**
 * @since 2.0.0
 * @internal
 */
@effectsClass('TrackAsset')
export class TrackAsset extends PlayableAsset {
  id: string;
  name: string;
  binding: VFXItem;

  trackType = TrackType.MasterTrack;
  private clipSeed = 0;
  @serialize('TimelineClip')
  private clips: TimelineClip[] = [];
  @serialize()
  protected children: TrackAsset[] = [];

  initializeBinding (parentBinding: object) {
    this.binding = parentBinding as VFXItem;
  }

  /**
   * @internal
   */
  initializeBindingRecursive (parentBinding: object) {
    this.initializeBinding(parentBinding);

    for (const subTrack of this.children) {
      subTrack.initializeBindingRecursive(this.binding);
    }
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
    const tracks: TrackAsset[] = [];

    this.gatherCompilableTracks(tracks);
    const clips: TimelineClip[] = [];

    for (const track of tracks) {
      for (const clip of track.clips) {
        clips.push(clip);
      }
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

      timelineClip.playable = clipPlayable;
      mixer.addInput(clipPlayable, 0);
      mixer.setInputWeight(clipPlayable, 0);
    }

    return mixer;
  }

  /**
   * 重写该方法以创建自定义混合器
   */
  createTrackMixer (graph: PlayableGraph): Playable {
    return new Playable(graph);
  }

  override createPlayable (graph: PlayableGraph): Playable {
    return new Playable(graph);
  }

  getChildTracks () {
    return this.children;
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

  private gatherCompilableTracks (tracks: TrackAsset[]) {
    tracks.push(this);

    for (const subTrack of this.children) {
      subTrack.gatherCompilableTracks(tracks);
    }
  }
}

export enum TrackType {
  MasterTrack,
  ObjectTrack,
}

/**
 * @since 2.0.0
 * @internal
 */
@effectsClass('TimelineClip')
export class TimelineClip {
  id: string;
  name: string;
  start = 0;
  duration = 0;
  playable: Playable;
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
      this.parentMixer.setInputWeight(this.playable, 1.0);
    } else {
      this.parentMixer.setInputWeight(this.playable, 0);
    }
  }

  evaluateAt (localTime: number) {
    const clip = this.clip;

    if (clip.playable.getPlayState() === PlayState.Delayed) {
      clip.playable.play();
    }
    let weight = 1.0;
    let ended = false;
    let started = false;

    if (localTime > clip.start + clip.duration + 0.001 && clip.endBehaviour === ItemEndBehavior.destroy) {
      if (VFXItem.isParticle(this.track.binding) && !this.track.binding.getComponent(ParticleSystem)?.destroyed) {
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
    this.parentMixer.setInputWeight(this.playable, weight);

    const bindingItem = this.track.binding;

    // 判断动画是否结束
    if (ended && !bindingItem.ended) {
      bindingItem.ended = true;
      bindingItem.onEnd();
    }
    if (ended && clip.endBehaviour === ItemEndBehavior.destroy) {
      this.onClipEnd();
    }
    // 判断动画是否开始
    if (bindingItem.delaying && started) {
      bindingItem.delaying = false;
    }
    const clipTime = clip.toLocalTime(localTime);

    this.playable.setTime(clipTime);
  }

  private onClipEnd () {
    this.clip.playable.dispose();
    const bindingItem = this.track.binding;

    bindingItem.delaying = true;
    if (!bindingItem.compositionReusable && !bindingItem.reusable) {
      bindingItem.dispose();

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