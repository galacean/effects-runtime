import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../../decorators';
import type { VFXItem } from '../../../vfx-item';
import type { RuntimeClip, TrackAsset } from '../track';
import { ObjectBindingTrack } from '../../cal/calculate-item';
import { PlayState, Playable, PlayableAsset } from '../../cal/playable-graph';
import type { Constructor } from '../../../utils';
import { TrackInstance } from '../track-instance';
import type { SceneBinding } from 'packages/effects-core/src/comp-vfx-item';

@effectsClass(spec.DataType.TimelineAsset)
export class TimelineAsset extends PlayableAsset {
  @serialize()
  tracks: TrackAsset[] = [];

  private cacheFlattenedTracks: TrackAsset[] | null = null;

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

  override createPlayable (): Playable {
    return new Playable();
  }

  createTimelinePlayable (sceneBindings: SceneBinding[]): TimelinePlayable {
    const timelinePlayable = new TimelinePlayable();
    const sceneBindingMap: Record<string, VFXItem> = {};

    for (const sceneBinding of sceneBindings) {
      sceneBindingMap[sceneBinding.key.getInstanceId()] = sceneBinding.value;
    }

    for (const track of this.tracks) {
      if (track instanceof ObjectBindingTrack) {
        track.create(this, sceneBindingMap);
      }
    }

    timelinePlayable.compileTracks(this.flattenedTracks, sceneBindings);

    return timelinePlayable;
  }

  createTrack<T extends TrackAsset>(classConstructor: Constructor<T>, parent: TrackAsset, name?: string): T {
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

  override fromData (data: spec.TimelineAssetData): void {
  }
}

export class TimelinePlayable extends Playable {
  clips: RuntimeClip[] = [];
  masterTrackInstances: TrackInstance[] = [];

  evaluate (deltaTime: number) {
    const time = this.getTime();

    // TODO search active clips

    for (const clip of this.clips) {
      clip.evaluateAt(time);
    }

    for (const track of this.masterTrackInstances) {
      this.tickTrack(track, deltaTime);
    }
  }

  compileTracks (tracks: TrackAsset[], sceneBindings: SceneBinding[]) {

    const outputTrack: TrackAsset[] = tracks;

    // map for searching track instance with track asset guid
    const trackInstanceMap: Record<string, TrackInstance> = {};

    for (const track of outputTrack) {
      // create track mixer and track output
      const trackMixPlayable = track.createPlayableGraph(this.clips);

      const trackOutput = track.createOutput();

      trackOutput.setSourcePlayable(trackMixPlayable);

      // create track instance
      const trackInstance = new TrackInstance(track, trackMixPlayable, trackOutput);

      trackInstanceMap[track.getInstanceId()] = trackInstance;

      if (!track.parent) {
        this.masterTrackInstances.push(trackInstance);
      }
    }

    // build trackInstance tree
    for (const track of outputTrack) {
      const trackInstance = trackInstanceMap[track.getInstanceId()];

      for (const child of track.getChildTracks()) {
        const childTrackInstance = trackInstanceMap[child.getInstanceId()];

        trackInstance.addChild(childTrackInstance);
      }
    }

    for (const sceneBinding of sceneBindings) {
      trackInstanceMap[sceneBinding.key.getInstanceId()].boundObject = sceneBinding.value;
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
      const boundObject = subTrack.trackAsset.updateAnimatedObject(trackInstance.boundObject);

      if (!subTrack.boundObject) {
        subTrack.boundObject = boundObject;
      }
      this.updateTrackAnimatedObject(subTrack);
    }
  }
}