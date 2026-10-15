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

  override fromData (data: spec.TimelineAssetData): void {
    super.fromData(data);
    if (data.tracks !== undefined) {
      this.tracks = data.tracks.map(track => this.findObject<TrackAsset>(track));
      this.invalidate();
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

    this.invalidate();

    return newTrack;
  }

  /**
   * Invalidates the asset, called when tracks data changed
   */
  private invalidate () {
    this.cacheFlattenedTracks = null;
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

  constructor (timelineAsset: TimelineAsset, sceneBindings: SceneBinding[]) {
    const sceneBindingMap: Record<string, VFXItem> = {};

    for (const sceneBinding of sceneBindings) {
      sceneBindingMap[sceneBinding.key.getInstanceId()] = sceneBinding.value;
    }

    // TODO: Hack 临时生成轨道, 待移除
    for (const track of timelineAsset.tracks) {
      if (track instanceof ObjectBindingTrack) {
        track.create(timelineAsset, sceneBindingMap);
      }
    }

    this.compileTracks(timelineAsset.flattenedTracks, sceneBindings);
  }

  evaluate (time: number, deltaTime: number) {
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

  compileTracks (tracks: TrackAsset[], sceneBindings: SceneBinding[]) {
    this.masterTracks.length = 0;
    this.tracks.length = 0;
    this.boundObjects.clear();

    for (const track of tracks) {
      if (!track.parent) {
        this.masterTracks.push(this.compileTrack(track));
      }
    }

    for (const sceneBinding of sceneBindings) {
      this.boundObjects.set(sceneBinding.key.getInstanceId(), sceneBinding.value);
    }

    // Resolve inherited bindings once, following the compiled execution order.
    for (const mixer of this.tracks) {
      const track = mixer.sourceTrack;

      if (track.parent && !this.boundObjects.has(mixer.objectBindingId)) {
        const parentObject = this.getBoundObject(track.parent.getInstanceId());
        const boundObject = track.updateAnimatedObject(parentObject!);

        this.boundObjects.set(mixer.objectBindingId, boundObject);
      }
    }
  }

  private compileTrack (track: TrackAsset): TrackMixerPlayable {
    const mixer = track.createPlayableGraph();

    this.tracks.push(mixer);
    for (const child of track.getChildTracks()) {
      this.compileTrack(child);
    }

    return mixer;
  }
}
