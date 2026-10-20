import * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import type { PlayableAsset } from './playable';
import type { Constructor } from '../../utils';
import type { ClipEvaluationData } from './playables';
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
  updateAnimatedObject (boundObject: object): object | undefined {
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
    const evaluationClips: ClipEvaluationData[] = [];

    mixer.sourceTrack = this;
    mixer.objectBindingId = this.getInstanceId();
    for (const clip of timelineClips) {
      const playable = clip.asset.createPlayable();
      const playableIndex = mixer.clipPlayables.length;

      playable.duration = clip.duration;
      mixer.clipPlayables.push(playable);
      mixer.clipWeights.push(0);
      evaluationClips.push({ playableIndex, start: clip.start, duration: clip.duration, endBehavior: clip.endBehavior });
    }
    mixer.compileSegments(evaluationClips);

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
