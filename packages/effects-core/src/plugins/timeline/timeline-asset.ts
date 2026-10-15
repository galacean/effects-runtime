import * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import { effectsClass } from '../../decorators';
import type { VFXItem } from '../../vfx-item';
import type { TrackAsset } from './track';
import { ObjectBindingTrack } from './tracks';
import type { FrameContext } from './playable';
import type { TrackMixerPlayable } from './playables';
import type { Constructor } from '../../utils';
import type { SceneBinding } from '../../components';

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

  private readonly boundObjects = new Map<string, object>();
  private readonly context: FrameContext = { time: 0, deltaTime: 0 };
  private needsCompile = false;

  constructor (
    private readonly timelineAsset: TimelineAsset,
    private readonly sceneBindings: SceneBinding[],
  ) {
    this.rebuild();
    timelineAsset.on('changed', this.onAssetChanged);
  }

  evaluate (time: number, deltaTime: number) {
    if (this.needsCompile) {
      this.rebuild();
    }
    this.context.time = time;
    this.context.deltaTime = deltaTime;

    for (const track of this.tracks) {
      track.prepareFrame(time);
    }

    for (const track of this.tracks) {
      const boundObject = this.getBoundObject(track.objectBindingId);

      if (boundObject) {
        track.processFrame(boundObject, this.context);
      }
    }
  }

  getBoundObject (objectBindingId: string): object | undefined {
    return this.boundObjects.get(objectBindingId);
  }

  compileTracks (rootTracks: TrackAsset[], sceneBindings: SceneBinding[]) {
    this.masterTracks.length = 0;
    this.tracks.length = 0;
    this.boundObjects.clear();

    for (const sceneBinding of sceneBindings) {
      this.boundObjects.set(sceneBinding.key.getInstanceId(), sceneBinding.value);
    }

    for (const track of rootTracks) {
      this.masterTracks.push(this.compileTrack(track));
    }
  }

  dispose (): void {
    this.timelineAsset.off('changed', this.onAssetChanged);
    this.needsCompile = false;
    this.masterTracks.length = 0;
    this.tracks.length = 0;
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
    this.compileTracks(this.timelineAsset.tracks, this.sceneBindings);
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
