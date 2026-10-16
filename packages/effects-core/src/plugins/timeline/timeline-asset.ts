import * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import { VFXItem } from '../../vfx-item';
import type { TrackAsset } from './track';
import { ObjectBindingTrack } from './tracks';
import type { FrameContext } from './playable';
import type { TrackMixerPlayable } from './playables';
import type { Constructor } from '../../utils';
import type { SceneBinding } from '../../components';
import { CompositionComponent } from '../../components';
import type { EvaluationFieldSegmentRef, OrderedEvaluationKey } from './evaluation-field';
import { EvaluationField, EvaluationMetaData } from './evaluation-field';

interface CompiledTrack {
  track: TrackMixerPlayable,
  boundObject: object | undefined,
}

@effectsClass(spec.DataType.TimelineAsset)
export class TimelineAsset extends Asset {
  tracks: TrackAsset[] = [];

  private cacheFlattenedTracks: TrackAsset[] | null = null;

  /** Invalidates asset caches and notifies timeline instances after an edit. */
  markAsChanged (): void {
    this.cacheFlattenedTracks = null;
    this.eventEmitter.emit('changed', this);
  }

  override fromData (data: spec.TimelineAssetData): void {
    super.fromData(data);
    if (data.tracks !== undefined) {
      this.tracks = data.tracks.map(track => this.findObject<TrackAsset>(track));
      // setData emits changed after deserialization.
      this.cacheFlattenedTracks = null;
    }
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

    this.markAsChanged();

    return newTrack;
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
  readonly masterTracks: TrackMixerPlayable[] = [];

  /** Compiled evaluators in parent-before-child execution order. @internal */
  readonly tracks: TrackMixerPlayable[] = [];

  private readonly cachedNestedCompositions: CompositionComponent[] = [];
  private readonly cachedOrderedBoundItems: VFXItem[] = [];
  private readonly boundObjects = new Map<string, object>();
  private readonly evaluationField = new EvaluationField();
  /** Compiled track lookup, including stale tracks until their entities have been torn down. */
  private readonly evaluationTracks = new Map<number, CompiledTrack>();
  private readonly trackIdentifiers: number[] = [];
  private thisFrameMetaData = new EvaluationMetaData();
  private lastFrameMetaData = new EvaluationMetaData();
  private readonly newEntities: OrderedEvaluationKey[] = [];
  private readonly expiredEntities: OrderedEvaluationKey[] = [];
  private nextTrackIdentifier = 0;
  private staleTrackIdentifierLimit = 0;
  private readonly context: FrameContext = { time: 0, deltaTime: 0 };
  private needsCompile = false;

  constructor (
    private readonly timelineAsset: TimelineAsset,
    private readonly sceneBindings: SceneBinding[],
  ) {
    this.rebuild();
    timelineAsset.on('changed', this.onAssetChanged);
  }

  get nestedCompositions (): CompositionComponent[] {
    // Playback controls must see edited bindings before the next evaluation.
    if (this.needsCompile) {
      this.rebuild();
    }

    return this.cachedNestedCompositions;
  }

  /** Scene items in root-track order. @internal */
  get orderedBoundItems (): readonly VFXItem[] {
    if (this.needsCompile) {
      this.rebuild();
    }

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

    this.callSetupTearDown();
    if (segmentRefs) {
      for (const segmentRef of segmentRefs) {
        const compiledTrack = this.evaluationTracks.get(segmentRef.trackIdentifier);

        if (compiledTrack) {
          compiledTrack.track.evaluate(segmentRef.segmentId, compiledTrack.boundObject, this.context);
        }
      }
    }
  }

  /** End the current evaluation without discarding compiled tracks. */
  finish (): void {
    this.swapFrameMetaData();
    this.callSetupTearDown();
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
      const { track } = this.evaluationTracks.get(segmentRef.trackIdentifier)!;

      track.clipWeights.fill(0);
      for (const clip of track.getSegment(segmentRef.segmentId).clips) {
        track.setClipWeight(clip.playableIndex, 1);
      }
    }

    return segmentRefs;
  }

  private callSetupTearDown (): void {
    this.thisFrameMetaData.diffEntities(this.lastFrameMetaData, this.newEntities, this.expiredEntities);
    this.callEntityLifecycle(this.expiredEntities, false);
    this.callEntityLifecycle(this.newEntities, true);

    if (this.staleTrackIdentifierLimit > 0) {
      for (const identifier of this.evaluationTracks.keys()) {
        if (identifier < this.staleTrackIdentifierLimit) {
          this.evaluationTracks.delete(identifier);
        }
      }
      this.staleTrackIdentifierLimit = 0;
    }
  }

  private callEntityLifecycle (entities: readonly OrderedEvaluationKey[], beginning: boolean): void {
    for (const { key } of entities) {
      const track = this.evaluationTracks.get(key.trackIdentifier)?.track;
      const entity = key.clipIndex === -1 ? track : track?.getClipPlayable(key.clipIndex);

      if (beginning) {
        entity?.onBeginEvaluation(this);
      } else {
        entity?.onEndEvaluation(this);
      }
    }
  }

  getBoundObject (objectBindingId: string): object | undefined {
    return this.boundObjects.get(objectBindingId);
  }

  private compileTracks (): void {
    // Recompilation must not end evaluation or restore scene state from a getter.
    this.clearTracks();
    this.staleTrackIdentifierLimit = this.nextTrackIdentifier;

    for (const sceneBinding of this.sceneBindings) {
      this.boundObjects.set(sceneBinding.key.getInstanceId(), sceneBinding.value);
    }

    for (const track of this.timelineAsset.tracks) {
      const mixer = this.compileTrack(track);

      this.masterTracks.push(mixer);
      const boundObject = this.getBoundObject(mixer.objectBindingId);

      if (boundObject instanceof VFXItem) {
        this.cachedOrderedBoundItems.push(boundObject);
        const composition = boundObject.getComponent(CompositionComponent);

        if (composition) {
          this.cachedNestedCompositions.push(composition);
        }
      }
    }
    this.evaluationField.compile(this.trackIdentifiers.map((trackIdentifier, index) => ({
      trackIdentifier, track: this.tracks[index],
    })));
  }

  dispose (): void {
    this.timelineAsset.off('changed', this.onAssetChanged);
    this.needsCompile = false;
    this.finish();
    this.clearTracks();
    this.evaluationTracks.clear();
  }

  private clearTracks (): void {
    this.masterTracks.length = 0;
    this.tracks.length = 0;
    this.trackIdentifiers.length = 0;
    this.evaluationField.reset();
    this.cachedNestedCompositions.length = 0;
    this.cachedOrderedBoundItems.length = 0;
    this.boundObjects.clear();
  }

  private readonly onAssetChanged = (): void => {
    this.needsCompile = true;
  };

  private rebuild (): void {
    const sceneBindingMap: Record<string, VFXItem> = {};

    for (const sceneBinding of this.sceneBindings) {
      sceneBindingMap[sceneBinding.key.getInstanceId()] = sceneBinding.value;
    }
    // TODO: Hack 临时生成轨道, 待移除
    for (const track of this.timelineAsset.tracks) {
      if (track instanceof ObjectBindingTrack) {
        track.create(this.timelineAsset, sceneBindingMap);
      }
    }
    this.compileTracks();
    this.needsCompile = false;
  }

  private compileTrack (track: TrackAsset, parent?: TrackAsset): TrackMixerPlayable {
    const mixer = track.createPlayableGraph();

    if (parent && !this.boundObjects.has(mixer.objectBindingId)) {
      const parentObject = this.getBoundObject(parent.getInstanceId());

      if (parentObject) {
        this.boundObjects.set(mixer.objectBindingId, track.updateAnimatedObject(parentObject));
      }
    }
    const trackIdentifier = this.nextTrackIdentifier++;

    this.tracks.push(mixer);
    this.trackIdentifiers.push(trackIdentifier);
    this.evaluationTracks.set(trackIdentifier, {
      track: mixer, boundObject: this.getBoundObject(mixer.objectBindingId),
    });
    for (const child of track.getChildTracks()) {
      this.compileTrack(child, track);
    }

    return mixer;
  }
}
