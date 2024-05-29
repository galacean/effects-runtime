import type { DataPath, EffectsObjectData } from '@galacean/effects-specification';
import { effectsClass } from '../../decorators';
import type { VFXItem } from '../../vfx-item';
import type { RuntimeClip, TrackAsset } from '../timeline/track';
import type { ObjectBindingTrack } from './calculate-item';
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

  addSubTracksRecursive (track: TrackAsset, allTracks: TrackAsset[]) {
    for (const subTrack of track.getChildTracks()) {
      allTracks.push(subTrack);
    }
    for (const subTrack of track.getChildTracks()) {
      this.addSubTracksRecursive(subTrack, allTracks);
    }
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

    for (const clip of this.clips) {
      if (time >= clip.clip.start) {
        clip.evaluateAt(time);
      }
    }
  }

  compileTracks (graph: PlayableGraph, tracks: TrackAsset[]) {
    this.sortTracks(tracks);
    for (const track of tracks) {
      // 获取所有的合成元素绑定 Track
      const newObjectBindingTrack = track as ObjectBindingTrack;

      newObjectBindingTrack.create();
      this.masterTracks.push(newObjectBindingTrack);
    }
    for (const track of tracks) {
      const trackMixPlayable = track.createPlayableGraph(graph, this.clips);

      // TODO 移至 Composition Component play
      trackMixPlayable.play();

      this.addInput(trackMixPlayable, 0);
      const trackOutput = track.createOutput();

      trackOutput.setUserData(track.binding);

      graph.addOutput(trackOutput);
      trackOutput.setSourcePlayeble(this, this.getInputCount() - 1);
    }
  }

  sortTracks (tracks: TrackAsset[]) {
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
  if (isAncestor(a.track.binding, b.track.binding)) {
    return -1;
  } else if (isAncestor(b.track.binding, a.track.binding)) {
    return 1;
  } else {
    return a.originalIndex - b.originalIndex; // 非父子关系的元素保持原始顺序
  }
}
