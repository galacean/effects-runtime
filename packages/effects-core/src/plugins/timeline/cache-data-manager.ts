/** Storage owned by a timeline instance, independently of evaluation proxies. */
export interface CacheDataStore {
  readonly trackData: Map<number, unknown>,
  readonly clipData: Map<number, Map<number, unknown>>,
  readonly sharedData: Map<object, unknown>,
}

/**
 * Accesses timeline-owned runtime data using the current evaluation keys.
 * A proxy is reused across tracks and clips during an evaluation call.
 * Each track or clip stores one state type, chosen consistently by its evaluator.
 */
export class CacheDataManager {
  private trackIdentifier: number | undefined;
  private clipIndex: number | undefined;

  constructor (private readonly data: CacheDataStore) {}

  setTrackKey (trackIdentifier: number | undefined): void {
    this.trackIdentifier = trackIdentifier;
    this.clipIndex = undefined;
  }

  setClipKey (clipIndex: number | undefined): void {
    this.clipIndex = clipIndex;
  }

  getOrAddTrackData<T> (create: () => T): T {
    return this.getOrAdd(this.data.trackData, this.getTrackIdentifier(), create);
  }

  getOrAddClipData<T> (create: () => T): T {
    const trackIdentifier = this.getTrackIdentifier();
    const clipIndex = this.getClipIndex();
    let clips = this.data.clipData.get(trackIdentifier);

    if (!clips) {
      clips = new Map();
      this.data.clipData.set(trackIdentifier, clips);
    }

    return this.getOrAdd(clips, clipIndex, create);
  }

  /** Data shared by evaluators within the owning timeline instance. */
  getOrAddSharedData<T> (key: object, create: () => T): T {
    return this.getOrAdd(this.data.sharedData, key, create);
  }

  resetTrackData (): void {
    this.data.trackData.delete(this.getTrackIdentifier());
  }

  resetClipData (): void {
    const trackIdentifier = this.getTrackIdentifier();
    const clipIndex = this.getClipIndex();
    const clips = this.data.clipData.get(trackIdentifier);

    if (clips) {
      clips.delete(clipIndex);
      if (clips.size === 0) {
        this.data.clipData.delete(trackIdentifier);
      }
    }
  }

  private getTrackIdentifier (): number {
    if (this.trackIdentifier === undefined) {
      throw new Error('No track is selected for cache data access.');
    }

    return this.trackIdentifier;
  }

  private getClipIndex (): number {
    if (this.clipIndex === undefined) {
      throw new Error('No clip is selected for cache data access.');
    }

    return this.clipIndex;
  }

  private getOrAdd<TKey, T> (data: Map<TKey, unknown>, key: TKey, create: () => T): T {
    if (!data.has(key)) {
      data.set(key, create());
    }

    return data.get(key) as T;
  }
}
