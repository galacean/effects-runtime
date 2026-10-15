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
  private evaluatingTracks = new Map<TrackMixerPlayable, object>();
  private previousEvaluatingTracks = new Map<TrackMixerPlayable, object>();
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

    const previousTracks = this.evaluatingTracks;

    this.evaluatingTracks = this.previousEvaluatingTracks;
    this.previousEvaluatingTracks = previousTracks;
    const currentTracks = this.evaluatingTracks;

    currentTracks.clear();

    for (const track of this.tracks) {
      track.prepareFrame(time);
    }
    // Store child tracks first so teardown can iterate without copying entries.
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const track = this.tracks[i];
      const boundObject = this.getBoundObject(track.objectBindingId);

      if (boundObject && track.hasActiveSegment()) {
        currentTracks.set(track, boundObject);
      }
    }
    // End expired tracks before beginning any tracks at the new evaluation time.
    for (const [track, boundObject] of previousTracks) {
      if (!currentTracks.has(track)) {
        track.onEndEvaluation(boundObject);
      }
    }
    for (const track of this.tracks) {
      const boundObject = currentTracks.get(track);

      if (boundObject && !previousTracks.has(track)) {
        track.onBeginEvaluation(boundObject);
      }
    }

    for (const track of this.tracks) {
      const boundObject = currentTracks.get(track);

      if (boundObject) {
        track.processFrame(boundObject, this.context);
      }
    }
  }

  /** End the current evaluation without discarding compiled tracks. */
  finish (): void {
    this.previousEvaluatingTracks.clear();
    for (const [track, boundObject] of this.evaluatingTracks) {
      this.evaluatingTracks.delete(track);

      track.onEndEvaluation(boundObject);
    }
  }

  getBoundObject (objectBindingId: string): object | undefined {
    return this.boundObjects.get(objectBindingId);
  }

  private compileTracks (): void {
    // Recompilation must not end evaluation or restore scene state from a getter.
    this.clearTracks();

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
  }

  dispose (): void {
    this.timelineAsset.off('changed', this.onAssetChanged);
    this.needsCompile = false;
    this.finish();
    this.clearTracks();
  }

  private clearTracks (): void {
    this.masterTracks.length = 0;
    this.tracks.length = 0;
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
    this.tracks.push(mixer);
    for (const child of track.getChildTracks()) {
      this.compileTrack(child, track);
    }

    return mixer;
  }
}
