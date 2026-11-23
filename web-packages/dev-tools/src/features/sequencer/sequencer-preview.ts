import type { CompositionComponent, TimelineAsset, TrackAsset } from '@galacean/effects';

export function findSequenceTimeline (component: CompositionComponent): TimelineAsset | undefined {
  return component.timelineAsset ?? undefined;
}

/** Compile the editor's preview selection without changing the authored track tree. */
export function sampleSequencePreview (component: CompositionComponent, timeline: TimelineAsset, muted: ReadonlySet<string>): void {
  if (!muted.size) {
    timeline.markAsChanged(); component.sampleTime(component.getTime());

    return;
  }
  const tracks = [...timeline.flattenedTracks];
  const lists = [timeline.tracks, ...tracks.map(track => track.getChildTracks())];
  const saved = lists.map(list => [...list]);

  try {
    lists.forEach(list => {
      for (let index = list.length - 1; index >= 0; index--) {
        if (muted.has(list[index].getInstanceId())) { list.splice(index, 1); }
      }
    });
    timeline.markAsChanged(); component.sampleTime(component.getTime());
  } finally {
    lists.forEach((list, index) => list.splice(0, list.length, ...saved[index]));
    const flattened: TrackAsset[] = timeline.flattenedTracks;

    flattened.splice(0, flattened.length, ...tracks);
  }
}
