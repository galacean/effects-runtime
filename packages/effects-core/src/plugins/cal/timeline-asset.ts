import type { DataPath, EffectsObjectData } from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import { VFXItem } from '../../vfx-item';
import type { RuntimeClip, TrackAsset } from '../timeline/track';
import { ObjectBindingTrack } from './calculate-item';
import type { FrameContext, PlayableGraph } from './playable-graph';
import { Playable, PlayableAsset, PlayableTraversalMode } from './playable-graph';

export interface TimelineAssetData extends EffectsObjectData {
  tracks: DataPath[],
}

@effectsClass('TimelineAsset')
export class TimelineAsset extends PlayableAsset {
  tracks: TrackAsset[] = [];
  graph: PlayableGraph;

  override createPlayable (graph: PlayableGraph): Playable {
    this.graph = graph;
    const timelinePlayable = new TimelinePlayable(graph);

    timelinePlayable.setTraversalMode(PlayableTraversalMode.Passthrough);
    timelinePlayable.compileTracks(graph, this.tracks);

    return timelinePlayable;
  }

  override fromData (data: TimelineAssetData): void {
    this.tracks = data.tracks as TrackAsset[];
  }
}

export class TimelinePlayable extends Playable {
  clips: RuntimeClip[] = [];
  masterTracks: ObjectBindingTrack[] = [];

  override prepareFrame (context: FrameContext): void {
    this.evaluate();
  }

  evaluate () {
    const time = this.getTime();

    // TODO search active clips

    for (const clip of this.clips) {
      clip.evaluateAt(time);
    }
  }

  compileTracks (graph: PlayableGraph, tracks: TrackAsset[]) {
    this.sortTracks(tracks);
    for (const track of tracks) {
      if (track instanceof ObjectBindingTrack) {
        track.create();
      }
      this.masterTracks.push(track as ObjectBindingTrack);
    }
    const outputTrack: TrackAsset[] = [];

    for (const masterTrack of tracks) {
      outputTrack.push(masterTrack);
      this.addSubTracksRecursive(masterTrack, outputTrack);
    }

    for (const track of outputTrack) {
      const trackMixPlayable = track.createPlayableGraph(graph, this.clips);

      this.addInput(trackMixPlayable, 0);
      const trackOutput = track.createOutput();

      trackOutput.setUserData(track.binding);

      graph.addOutput(trackOutput);
      trackOutput.setSourcePlayeble(this, this.getInputCount() - 1);
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

  private addSubTracksRecursive (track: TrackAsset, allTracks: TrackAsset[]) {
    for (const subTrack of track.getChildTracks()) {
      allTracks.push(subTrack);
    }
    for (const subTrack of track.getChildTracks()) {
      this.addSubTracksRecursive(subTrack, allTracks);
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

function isAncestor (
  ancestorCandidate: VFXItem,
  descendantCandidate: VFXItem,
) {
  let current = descendantCandidate.parent;

  while (current) {
    if (current === ancestorCandidate) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

function compareTracks (a: TrackSortWrapper, b: TrackSortWrapper): number {
  const bindingA = a.track.binding;
  const bindingB = b.track.binding;

  if (!(bindingA instanceof VFXItem) || !(bindingB instanceof VFXItem)) {
    return a.originalIndex - b.originalIndex;
  }

  if (isAncestor(bindingA, bindingB)) {
    return -1;
  } else if (isAncestor(bindingB, bindingA)) {
    return 1;
  } else {
    return a.originalIndex - b.originalIndex; // 非父子关系的元素保持原始顺序
  }
}
