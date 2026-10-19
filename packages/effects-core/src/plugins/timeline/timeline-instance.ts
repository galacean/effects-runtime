import * as spec from '@galacean/effects-specification';
import { VFXItem } from '../../vfx-item';
import type { SceneBinding } from '../../components';
import type { EvaluationFieldSegmentRef, OrderedEvaluationKey } from './evaluation-field';
import { EvaluationField, EvaluationMetaData } from './evaluation-field';
import { ObjectBindingCache } from './object-binding-cache';
import { CacheDataManager } from './cache-data-manager';
import type { CacheDataStore } from './cache-data-manager';
import type { FrameContext } from './playable';
import type { ClipEvaluationData, TrackMixerPlayable } from './playables';
import type { TimelineAsset } from './timeline-asset';
import type { TrackAsset } from './track';
import { ObjectBindingTrack } from './tracks';

export class TimelineInstance {
  /**
   * @internal
   */
  readonly masterTracks: TrackMixerPlayable[] = [];

  /** Compiled evaluators in parent-before-child execution order. @internal */
  readonly tracks: TrackMixerPlayable[] = [];

  /** Runtime data owned by this playback instance. @internal */
  readonly cacheData: CacheDataStore = {
    trackData: new Map(),
    clipData: new Map(),
    sharedData: new Map(),
  };

  private readonly cachedOrderedBoundItems: VFXItem[] = [];
  private readonly objectCache: ObjectBindingCache;
  private readonly compatibilityTracks: TrackAsset[] = [];
  private readonly evaluationField = new EvaluationField();
  /** Compiled track lookup, including stale tracks until their entities have been torn down. */
  private readonly evaluationTracks = new Map<number, TrackMixerPlayable>();
  private readonly trackIdentifiers: number[] = [];
  private thisFrameMetaData = new EvaluationMetaData();
  private lastFrameMetaData = new EvaluationMetaData();
  private readonly newEntities: OrderedEvaluationKey[] = [];
  private readonly expiredEntities: OrderedEvaluationKey[] = [];
  private nextTrackIdentifier = 0;
  private staleTrackIdentifierLimit = 0;
  private readonly context: FrameContext = { time: 0, deltaTime: 0 };
  private readonly clipContext: FrameContext = { time: 0, deltaTime: 0 };
  private needsCompile = false;

  constructor (
    private readonly timelineAsset: TimelineAsset,
    sceneBindings: readonly SceneBinding[],
  ) {
    this.objectCache = new ObjectBindingCache(sceneBindings);
    this.rebuild();
    timelineAsset.on('changed', this.onAssetChanged);
  }

  /** Scene items in root-track order. @internal */
  get orderedBoundItems (): readonly VFXItem[] {
    if (this.needsCompile) {
      this.rebuild();
    }
    this.refreshOrderedBoundItems();

    return this.cachedOrderedBoundItems;
  }

  evaluate (time: number, deltaTime: number) {
    if (this.needsCompile) {
      this.rebuild();
    }
    this.context.time = time;
    this.context.deltaTime = deltaTime;

    this.swapFrameMetaData();
    const segmentRefs = this.setupFrame(time);
    const cache = new CacheDataManager(this.cacheData);

    this.callSetupTearDown(cache);
    if (segmentRefs) {
      for (const segmentRef of segmentRefs) {
        const track = this.evaluationTracks.get(segmentRef.trackIdentifier);

        if (track) {
          const boundObject = this.getBoundObject(track.objectBindingId);

          cache.setTrackKey(segmentRef.trackIdentifier);
          for (const clip of track.getSegment(segmentRef.segmentId).clips) {
            cache.setClipKey(clip.playableIndex);
            track.getClipPlayable(clip.playableIndex).evaluate(boundObject, this.getClipContext(clip), cache);
            cache.setClipKey(undefined);
          }
          track.evaluate(segmentRef.segmentId, boundObject, this.context, cache);
        }
      }
    }
  }

  private getClipContext (clip: ClipEvaluationData): FrameContext {
    let time = this.context.time - clip.start;

    if (time > clip.duration) {
      if (clip.endBehavior === spec.EndBehavior.restart) {
        time %= clip.duration;
      } else if (clip.endBehavior === spec.EndBehavior.freeze) {
        time = clip.duration;
      }
    }
    this.clipContext.time = time;
    this.clipContext.deltaTime = this.context.deltaTime;

    return this.clipContext;
  }

  /** End the current evaluation without discarding compiled tracks. */
  finish (): void {
    this.swapFrameMetaData();
    const cache = new CacheDataManager(this.cacheData);

    this.callSetupTearDown(cache);
    this.lastFrameMetaData.reset();
  }

  private swapFrameMetaData (): void {
    const previous = this.lastFrameMetaData;

    this.lastFrameMetaData = this.thisFrameMetaData;
    this.thisFrameMetaData = previous;
    this.thisFrameMetaData.reset();
  }

  private setupFrame (time: number): readonly EvaluationFieldSegmentRef[] | undefined {
    const fieldIndex = this.evaluationField.getSegmentFromTime(time);

    if (fieldIndex < 0) {
      return;
    }
    this.thisFrameMetaData.assign(this.evaluationField.getMetaData(fieldIndex));
    const segmentRefs = this.evaluationField.getSegmentRefs(fieldIndex);

    // Establish default weights before lifecycle callbacks, preserving explicit weight overrides during evaluation.
    for (const segmentRef of segmentRefs) {
      const track = this.evaluationTracks.get(segmentRef.trackIdentifier)!;

      track.clipWeights.fill(0);
      for (const clip of track.getSegment(segmentRef.segmentId).clips) {
        track.setClipWeight(clip.playableIndex, 1);
      }
    }

    return segmentRefs;
  }

  private callSetupTearDown (cache: CacheDataManager): void {
    this.thisFrameMetaData.diffEntities(this.lastFrameMetaData, this.newEntities, this.expiredEntities);
    this.callEntityLifecycle(this.expiredEntities, false, cache);
    this.callEntityLifecycle(this.newEntities, true, cache);

    if (this.staleTrackIdentifierLimit > 0) {
      for (const identifier of this.evaluationTracks.keys()) {
        if (identifier < this.staleTrackIdentifierLimit) {
          this.evaluationTracks.delete(identifier);
          this.cacheData.trackData.delete(identifier);
          this.cacheData.clipData.delete(identifier);
        }
      }
      this.staleTrackIdentifierLimit = 0;
    }
  }

  private callEntityLifecycle (entities: readonly OrderedEvaluationKey[], beginning: boolean, cache: CacheDataManager): void {
    for (const { key } of entities) {
      const track = this.evaluationTracks.get(key.trackIdentifier);

      if (!track) {
        continue;
      }
      const entity = key.clipIndex === -1 ? track : track.getClipPlayable(key.clipIndex);

      cache.setTrackKey(key.trackIdentifier);
      if (key.clipIndex !== -1) {
        cache.setClipKey(key.clipIndex);
      }
      if (beginning) {
        entity?.onBeginEvaluation(cache);
      } else {
        entity?.onEndEvaluation(cache);
        if (key.clipIndex === -1) {
          cache.resetTrackData();
        } else {
          cache.resetClipData();
        }
      }
    }
  }

  getBoundObject (objectBindingId: string): object | undefined {
    if (this.needsCompile) {
      this.rebuild();
    }

    return this.objectCache.findBoundObject(objectBindingId);
  }

  /** Replace the component's binding table without recompiling tracks. */
  setBindings (bindings: readonly SceneBinding[]): void {
    this.objectCache.setBindings(bindings);
  }

  /** Refresh bindings on the next lookup or evaluation without recompiling tracks. */
  invalidateBindings (track?: TrackAsset): void {
    this.objectCache.invalidate(track?.getInstanceId());
  }

  private compileTracks (): void {
    // Recompilation must not end evaluation or restore scene state from a getter.
    this.clearTracks();
    this.staleTrackIdentifierLimit = this.nextTrackIdentifier;

    for (const track of this.timelineAsset.tracks) {
      this.masterTracks.push(this.compileTrack(track));
    }
    this.evaluationField.compile(this.trackIdentifiers.map((trackIdentifier, index) => ({
      trackIdentifier, track: this.tracks[index],
    })));
  }

  private refreshOrderedBoundItems (): void {
    this.cachedOrderedBoundItems.length = 0;
    for (const mixer of this.masterTracks) {
      const boundObject = this.getBoundObject(mixer.objectBindingId);

      if (boundObject instanceof VFXItem) {
        this.cachedOrderedBoundItems.push(boundObject);
      }
    }
  }

  dispose (): void {
    this.timelineAsset.off('changed', this.onAssetChanged);
    this.needsCompile = false;
    this.finish();
    this.clearTracks();
    this.evaluationTracks.clear();
    this.cacheData.trackData.clear();
    this.cacheData.clipData.clear();
    this.cacheData.sharedData.clear();
  }

  private clearTracks (): void {
    for (const track of this.compatibilityTracks) {
      for (const clip of track.getClips()) {
        clip.asset.dispose();
      }
      track.dispose();
    }
    this.compatibilityTracks.length = 0;
    this.masterTracks.length = 0;
    this.tracks.length = 0;
    this.trackIdentifiers.length = 0;
    this.evaluationField.reset();
    this.cachedOrderedBoundItems.length = 0;
    this.objectCache.clear();
  }

  private readonly onAssetChanged = (): void => {
    this.needsCompile = true;
  };

  private rebuild (): void {
    this.compileTracks();
    this.needsCompile = false;
  }

  private compileTrack (track: TrackAsset): TrackMixerPlayable {
    const mixer = track.createPlayableGraph();
    const trackIdentifier = this.nextTrackIdentifier++;

    this.tracks.push(mixer);
    this.trackIdentifiers.push(trackIdentifier);
    this.evaluationTracks.set(trackIdentifier, mixer);
    this.objectCache.addTrack(track);
    for (const child of track.getChildTracks()) {
      this.compileTrack(child);
    }
    if (track instanceof ObjectBindingTrack) {
      const compatibilityTracks = track.createCompatibilityTracks();

      this.compatibilityTracks.push(...compatibilityTracks);
      for (const child of compatibilityTracks) {
        this.compileTrack(child);
      }
    }

    return mixer;
  }
}
