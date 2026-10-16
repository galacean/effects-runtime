import type { TrackMixerPlayable } from './playables/track-mixer-playable';

/** Identifies a compiled track or clip. A clip index of -1 identifies the track. */
export interface EvaluationKey {
  trackIdentifier: number,
  clipIndex: number,
}

export interface OrderedEvaluationKey {
  key: EvaluationKey,
  setupIndex: number,
  tearDownIndex: number,
}

/** Identifies a compiled segment by its track and segment IDs. */
export interface EvaluationFieldSegmentRef {
  trackIdentifier: number,
  segmentId: number,
}

interface EvaluationRange {
  start: number,
  end: number,
}

interface SegmentBoundary {
  time: number,
  entering: boolean,
  segmentRef: EvaluationFieldSegmentRef,
}

function compareKeys (a: EvaluationKey, b: EvaluationKey): number {
  return a.trackIdentifier - b.trackIdentifier || a.clipIndex - b.clipIndex;
}

/** Compiled active entities and their setup/teardown order for a field range. */
export class EvaluationMetaData {
  readonly activeEntities: OrderedEvaluationKey[] = [];

  reset (): void {
    this.activeEntities.length = 0;
  }

  assign (source: EvaluationMetaData): void {
    this.reset();
    for (const entity of source.activeEntities) {
      this.activeEntities.push(entity);
    }
  }

  /** Diff key-sorted entities, then order callbacks independently of key order. */
  diffEntities (
    lastFrame: EvaluationMetaData,
    newKeys: OrderedEvaluationKey[],
    expiredKeys: OrderedEvaluationKey[],
  ): void {
    newKeys.length = 0;
    expiredKeys.length = 0;
    let currentIndex = 0;
    let previousIndex = 0;

    while (currentIndex < this.activeEntities.length && previousIndex < lastFrame.activeEntities.length) {
      const current = this.activeEntities[currentIndex];
      const previous = lastFrame.activeEntities[previousIndex];
      const order = compareKeys(current.key, previous.key);

      if (order === 0) {
        currentIndex++;
        previousIndex++;
      } else if (order < 0) {
        newKeys.push(current);
        currentIndex++;
      } else {
        expiredKeys.push(previous);
        previousIndex++;
      }
    }
    while (currentIndex < this.activeEntities.length) {
      newKeys.push(this.activeEntities[currentIndex++]);
    }
    while (previousIndex < lastFrame.activeEntities.length) {
      expiredKeys.push(lastFrame.activeEntities[previousIndex++]);
    }
    newKeys.sort((a, b) => a.setupIndex - b.setupIndex);
    expiredKeys.sort((a, b) => a.tearDownIndex - b.tearDownIndex);
  }
}

/** Timeline-wide ranges, ordered segment references and metadata share the same field index. */
export class EvaluationField {
  private readonly ranges: EvaluationRange[] = [];
  private readonly segmentRefs: (readonly EvaluationFieldSegmentRef[])[] = [];
  private readonly metaData: EvaluationMetaData[] = [];

  reset (): void {
    this.ranges.length = 0;
    this.segmentRefs.length = 0;
    this.metaData.length = 0;
  }

  compile (tracks: readonly { trackIdentifier: number, track: TrackMixerPlayable }[]): void {
    this.reset();
    const boundaries: SegmentBoundary[] = [];
    const tracksByIdentifier = new Map<number, TrackMixerPlayable>();

    for (const { trackIdentifier, track } of tracks) {
      tracksByIdentifier.set(trackIdentifier, track);
      const segments = track.getSegments();

      for (let segmentId = 0; segmentId < segments.length; segmentId++) {
        const segment = segments[segmentId];
        const segmentRef = { trackIdentifier, segmentId };

        boundaries.push({ time: segment.start, entering: true, segmentRef });
        boundaries.push({ time: segment.end, entering: false, segmentRef });
      }
    }
    // End the old segment before starting the next segment at a shared boundary.
    boundaries.sort((a, b) => a.time === b.time
      ? Number(a.entering) - Number(b.entering)
      : a.time < b.time ? -1 : 1);
    const activeSegments = new Map<number, EvaluationFieldSegmentRef>();
    let boundaryIndex = 0;

    while (boundaryIndex < boundaries.length) {
      const time = boundaries[boundaryIndex].time;

      do {
        const boundary = boundaries[boundaryIndex++];

        if (boundary.entering) {
          activeSegments.set(boundary.segmentRef.trackIdentifier, boundary.segmentRef);
        } else {
          activeSegments.delete(boundary.segmentRef.trackIdentifier);
        }
      } while (boundaryIndex < boundaries.length && boundaries[boundaryIndex].time === time);

      if (boundaryIndex === boundaries.length || activeSegments.size === 0) {
        continue;
      }
      const segmentRefs = Array.from(activeSegments.values()).sort((a, b) => a.trackIdentifier - b.trackIdentifier);
      const metadata = new EvaluationMetaData();
      let setupIndex = 0;

      for (const segmentRef of segmentRefs) {
        const track = tracksByIdentifier.get(segmentRef.trackIdentifier)!;
        const clipIndices = [-1, ...track.getSegment(segmentRef.segmentId).clips.map(clip => clip.playableIndex)];

        for (const clipIndex of clipIndices) {
          metadata.activeEntities.push({
            key: { trackIdentifier: segmentRef.trackIdentifier, clipIndex },
            setupIndex,
            // Tear down clips before tracks and child tracks before parents.
            tearDownIndex: -setupIndex,
          });
          setupIndex++;
        }
      }
      metadata.activeEntities.sort((a, b) => compareKeys(a.key, b.key));
      this.ranges.push({ start: time, end: boundaries[boundaryIndex].time });
      this.segmentRefs.push(segmentRefs);
      this.metaData.push(metadata);
    }
  }

  getSegmentFromTime (time: number): number {
    let lower = 0;
    let upper = this.ranges.length - 1;

    while (lower <= upper) {
      const index = Math.floor((lower + upper) / 2);
      const range = this.ranges[index];

      if (time < range.start) {
        upper = index - 1;
      } else if (time >= range.end) {
        lower = index + 1;
      } else {
        return index;
      }
    }

    return -1;
  }

  getSegmentRefs (index: number): readonly EvaluationFieldSegmentRef[] {
    return this.segmentRefs[index];
  }

  getMetaData (index: number): EvaluationMetaData {
    return this.metaData[index];
  }
}
