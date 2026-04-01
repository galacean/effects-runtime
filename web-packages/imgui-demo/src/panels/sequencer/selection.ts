import type { TrackAsset } from '@galacean/effects';
import type { SequencerState } from './sequencer-state';

export function selectTrack (state: SequencerState, track: TrackAsset): void {
  state.selectedTrack = track;

  // Try to find the ActivationTrack or any track with clips to select its first clip
  let targetTrackToSelectClip = track;
  let clips = typeof track.getClips === 'function' ? track.getClips() : [];

  if (!clips || clips.length === 0) {
    for (const child of track.getChildTracks()) {
      if (child.constructor.name === 'ActivationTrack' || child.constructor.name.includes('Activation')) {
        const childClips = typeof child.getClips === 'function' ? child.getClips() : [];

        if (childClips && childClips.length > 0) {
          targetTrackToSelectClip = child;
          clips = childClips;

          break;
        }
      }
    }
  }

  if (clips && clips.length > 0) {
    state.selectedClipTrack = targetTrackToSelectClip;
    state.selectedClip = clips[0];
  } else {
    state.selectedClipTrack = null;
    state.selectedClip = null;
  }
}

export function isTrackSelected (state: SequencerState, track: TrackAsset): boolean {
  return state.selectedTrack === track;
}

export function toggleTrackExpansion (state: SequencerState, track: TrackAsset): void {
  const trackId = track.getInstanceId().toString();

  if (state.expandedTracks.has(trackId)) {
    state.expandedTracks.delete(trackId);
  } else {
    state.expandedTracks.add(trackId);
  }
}

export function isTrackExpanded (state: SequencerState, track: TrackAsset): boolean {
  return state.expandedTracks.has(track.getInstanceId().toString());
}

export function getKeyframeId (trackId: string, propName: string, keyframeIndex: number): string {
  return `${trackId}_${propName}_${keyframeIndex}`;
}

export function toggleKeyframeSelection (state: SequencerState, keyframeId: string, ctrlPressed: boolean): void {
  if (ctrlPressed) {
    if (state.selectedKeyframes.has(keyframeId)) {
      state.selectedKeyframes.delete(keyframeId);
    } else {
      state.selectedKeyframes.add(keyframeId);
    }
  } else {
    state.selectedKeyframes.clear();
    state.selectedKeyframes.add(keyframeId);
  }
}

export function clearKeyframeSelection (state: SequencerState): void {
  state.selectedKeyframes.clear();
}
