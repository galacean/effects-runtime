import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../../decorators';
import { VFXItem } from '../../../vfx-item';
import type { RuntimeClip, TrackAsset } from '../track';
import { ObjectBindingTrack } from '../../cal/calculate-item';
import type { FrameContext, PlayableGraph } from '../../cal/playable-graph';
import { Playable, PlayableAsset } from '../../cal/playable-graph';
import type { Constructor } from '../../../utils';
import { TrackInstance } from '../track-instance';

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

  override createPlayable (graph: PlayableGraph): Playable {
    const timelinePlayable = new TimelinePlayable(graph);

    for (const track of this.tracks) {
      if (track instanceof ObjectBindingTrack) {
        track.create(this);
      }
    }

    this.sortTracks(this.tracks);
    timelinePlayable.compileTracks(graph, this.flattenedTracks);

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

  private sortTracks (tracks: TrackAsset[]) {
    const sortedTracks = [];

    for (let i = 0; i < tracks.length; i++) {
      sortedTracks.push(new TrackSortWrapper(tracks[i], i));
    }
    sortedTracks.sort(compareTracks);
    tracks.length = 0;
    for (const trackWrapper of sortedTracks) {
      tracks.push(trackWrapper.track);
    }
  }

  override fromData (data: spec.TimelineAssetData): void {
  }
}

export class TimelinePlayable extends Playable {
  clips: RuntimeClip[] = [];
  masterTrackInstances: TrackInstance[] = [];

  override prepareFrame (context: FrameContext): void {
  }

  evaluate () {
    const time = this.getTime();

    // TODO search active clips

    for (const clip of this.clips) {
      clip.evaluateAt(time);
    }
  }

  compileTracks (graph: PlayableGraph, tracks: TrackAsset[]) {
    const outputTrack: TrackAsset[] = tracks;

    // map for searching track instance with track asset guid
    const trackInstanceMap: Record<string, TrackInstance> = {};

    for (const track of outputTrack) {
      // create track mixer and track output
      const trackMixPlayable = track.createPlayableGraph(graph, this.clips);

      const trackOutput = track.createOutput();

      trackOutput.setUserData(track.boundObject);

      graph.addOutput(trackOutput);
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
  }
}

export class TrackSortWrapper {
  track: TrackAsset;
  originalIndex: number;

  constructor (track: TrackAsset, originalIndex: number) {
    this.track = track;
    this.originalIndex = originalIndex;
  }
}

function compareTracks (a: TrackSortWrapper, b: TrackSortWrapper): number {
  const bindingA = a.track.boundObject;
  const bindingB = b.track.boundObject;

  if (!(bindingA instanceof VFXItem) || !(bindingB instanceof VFXItem)) {
    return a.originalIndex - b.originalIndex;
  }

  if (VFXItem.isAncestor(bindingA, bindingB)) {
    return -1;
  } else if (VFXItem.isAncestor(bindingB, bindingA)) {
    return 1;
  } else {
    return a.originalIndex - b.originalIndex; // 非父子关系的元素保持原始顺序
  }
}
