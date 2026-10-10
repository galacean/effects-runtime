import * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import type { VFXItem } from '../../vfx-item';
import type { RuntimeClip, TrackAsset } from './track';
import { ObjectBindingTrack } from './tracks';
import { PlayState } from './playable';
import type { Constructor } from '../../utils';
import { TrackInstance } from './track-instance';
import type { CompositionComponent, SceneBinding } from '../../components';

@effectsClass(spec.DataType.TimelineAsset)
export class TimelineAsset extends Asset {
  tracks: TrackAsset[] = [];

  private cacheFlattenedTracks: TrackAsset[] | null = null;

  override fromData (data: spec.TimelineAssetData): void {
    super.fromData(data);
    this.tracks = (data.tracks ?? []).map(track => this.findObject<TrackAsset>(track));
    this.invalidate();
  }

  get flattenedTracks () {
    if (!this.cacheFlattenedTracks) {
      this.cacheFlattenedTracks = [];
      // flatten track tree
      for (const masterTrack of this.tracks) {
        this.cacheFlattenedTracks.push(masterTrack);
        this.addSubTracksRecursive(masterTrack, this.cacheFlattenedTracks);
      }
    }

    return this.cacheFlattenedTracks;
  }

  createTrack<T extends TrackAsset> (classConstructor: Constructor<T>, parent: TrackAsset, name?: string): T {
    const newTrack = new classConstructor(this.engine);

    newTrack.name = name ? name : classConstructor.name;
    parent.addChild(newTrack);

    this.invalidate();

    return newTrack;
  }

  /**
   * Invalidates the asset, called when tracks data changed
   */
  private invalidate () {
    this.cacheFlattenedTracks = null;
  }

  private addSubTracksRecursive (track: TrackAsset, allTracks: TrackAsset[]) {
    for (const subTrack of track.getChildTracks()) {
      allTracks.push(subTrack);
    }
    for (const subTrack of track.getChildTracks()) {
      this.addSubTracksRecursive(subTrack, allTracks);
    }
  }
}

export class TimelineInstance {
  /**
   * @internal
   */
  masterTrackInstances: TrackInstance[] = [];

  private clips: RuntimeClip[] = [];
  private generatedTracks: TrackAsset[] = [];

  constructor (
    timelineAsset: TimelineAsset,
    sceneBindings: SceneBinding[],
    private readonly composition: CompositionComponent,
  ) {
    const sceneBindingMap: Record<string, VFXItem> = {};

    for (const sceneBinding of sceneBindings) {
      sceneBindingMap[sceneBinding.key.getInstanceId()] = sceneBinding.value;
    }

    // 辅助轨道属于当前播放实例，避免重建时修改共享资产或重复累积轨道。
    for (const track of timelineAsset.tracks) {
      if (track instanceof ObjectBindingTrack) {
        this.generatedTracks.push(...track.create(sceneBindingMap));
      }
    }

    this.compileTracks([...timelineAsset.flattenedTracks, ...this.generatedTracks], sceneBindings);
  }

  evaluate (time: number, deltaTime: number) {
    // TODO search active clips

    for (const clip of this.clips) {
      clip.evaluateAt(time);
    }

    for (const track of this.masterTrackInstances) {
      this.tickTrack(track, deltaTime);
    }
  }

  /** 释放播放图，保留共享资产和绑定的场景对象。 */
  dispose (): void {
    this.clips = [];
    this.masterTrackInstances = [];
    for (const track of this.generatedTracks) {
      for (const clip of track.getClips()) {
        clip.asset.dispose();
      }
      track.dispose();
    }
    this.generatedTracks = [];
  }

  compileTracks (tracks: TrackAsset[], sceneBindings: SceneBinding[]) {

    const outputTrack: TrackAsset[] = tracks;

    // Map for searching track instance with track asset guid
    const trackInstanceMap: Record<string, TrackInstance> = {};

    for (const track of outputTrack) {
      // Create track mixer and track output
      const trackMixPlayable = track.createPlayableGraph(this.clips);

      const trackOutput = track.createOutput();

      // Create track instance
      const trackInstance = new TrackInstance(track, trackMixPlayable, trackOutput, this.composition);

      trackInstanceMap[track.getInstanceId()] = trackInstance;

      if (!track.parent) {
        this.masterTrackInstances.push(trackInstance);
      }
    }

    // Build trackInstance tree
    for (const track of outputTrack) {
      const trackInstance = trackInstanceMap[track.getInstanceId()];

      if (track.parent) {
        trackInstanceMap[track.parent.getInstanceId()]?.addChild(trackInstance);
      }
    }

    for (const sceneBinding of sceneBindings) {
      const trackInstance = trackInstanceMap[sceneBinding.key.getInstanceId()];

      if (trackInstance) {
        trackInstance.boundObject = sceneBinding.value;
      }
    }

    for (const trackInstance of this.masterTrackInstances) {
      this.updateTrackAnimatedObject(trackInstance);
    }
  }

  private tickTrack (track: TrackInstance, deltaTime: number) {

    const context = track.output.context;

    context.deltaTime = deltaTime;

    track.output.setUserData(track.boundObject);

    for (const clip of track.mixer.clipPlayables) {
      if (clip.getPlayState() === PlayState.Playing) {
        clip.processFrame(context);
      }
    }

    track.mixer.evaluate(context);

    for (const child of track.children) {
      this.tickTrack(child, deltaTime);
    }
  }

  private updateTrackAnimatedObject (trackInstance: TrackInstance) {
    for (const subTrack of trackInstance.children) {
      if (!subTrack.boundObject) {
        const boundObject = subTrack.trackAsset.updateAnimatedObject(trackInstance.boundObject);

        subTrack.boundObject = boundObject;
      }
      this.updateTrackAnimatedObject(subTrack);
    }
  }
}
