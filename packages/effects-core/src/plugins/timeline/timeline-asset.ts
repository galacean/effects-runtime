import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../decorators';
import { VFXItem } from '../../vfx-item';
import type { RuntimeClip, TrackAsset } from './track';
import { ObjectBindingTrack, TransformTrack } from './tracks';
import { PlayState } from './playable';
import type { Constructor } from '../../utils';
import { TrackInstance } from './track-instance';
import type { SceneBinding } from '../../components';
import { EffectsObject } from '../../effects-object';
import { TransformLayerMixer } from './transform-layer-mixer';

@effectsClass(spec.DataType.TimelineAsset)
export class TimelineAsset extends EffectsObject {
  @serialize()
  tracks: TrackAsset[] = [];

  private cacheFlattenedTracks: TrackAsset[] | null = null;

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
  masterTrackInstances: TrackInstance[] = [];

  private clips: RuntimeClip[] = [];
  /**
   * 私有 layer mixer map：key = item instanceId，value = TransformLayerMixer。
   * 仅当同一 VFXItem 被 ≥2 条 TransformTrack 绑定或含 additive 轨道时才创建 entry。
   * layer mixer 归属 TimelineInstance 而非 VFXItem，避免跨实例残留。
   */
  private layerMixerMap = new Map<string, TransformLayerMixer>();
  private layerMixerItemIds: string[] = [];
  private layerMixerItems: VFXItem[] = [];

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
    this.attachTransformLayerMixers(sceneBindings);
  }

  evaluate (time: number, deltaTime: number) {
    // TODO search active clips

    for (const clip of this.clips) {
      clip.evaluateAt(time);
    }

    for (const id of this.layerMixerItemIds) {
      this.layerMixerMap.get(id)?.resetFrame();
    }

    for (const track of this.masterTrackInstances) {
      this.tickTrack(track, deltaTime);
    }

    for (let i = 0; i < this.layerMixerItemIds.length; i++) {
      this.layerMixerMap.get(this.layerMixerItemIds[i])?.flush(this.layerMixerItems[i]);
    }
  }

  compileTracks (tracks: TrackAsset[], sceneBindings: SceneBinding[]) {

    const outputTrack: TrackAsset[] = tracks;

    // Map for searching track instance with track asset guid
    const trackInstanceMap: Record<string, TrackInstance> = {};

    for (const track of outputTrack) {
      // Create track mixer and track output
      const trackMixPlayable = track.createPlayableGraph(this.clips);

      const trackOutput = track.createOutput();

      // Create track instance
      const trackInstance = new TrackInstance(track, trackMixPlayable, trackOutput);

      trackInstanceMap[track.getInstanceId()] = trackInstance;

      if (!track.parent) {
        this.masterTrackInstances.push(trackInstance);
      }
    }

    // Build trackInstance tree
    for (const track of outputTrack) {
      const trackInstance = trackInstanceMap[track.getInstanceId()];

      for (const child of track.getChildTracks()) {
        const childTrackInstance = trackInstanceMap[child.getInstanceId()];

        trackInstance.addChild(childTrackInstance);
      }
    }

    for (const sceneBinding of sceneBindings) {
      trackInstanceMap[sceneBinding.key.getInstanceId()].boundObject = sceneBinding.value;
    }

    for (const trackInstance of this.masterTrackInstances) {
      this.updateTrackAnimatedObject(trackInstance);
    }
  }

  private attachTransformLayerMixers (sceneBindings: SceneBinding[]) {
    for (const sceneBinding of sceneBindings) {
      const item = sceneBinding.value;

      if (!(item instanceof VFXItem)) {
        continue;
      }
      const transformTracks: TransformTrack[] = [];

      this.collectTransformTracks(sceneBinding.key, transformTracks);

      if (transformTracks.length === 0) {
        continue;
      }
      const hasAdditive = transformTracks.some(t => t.blendMode === 'additive');

      if (transformTracks.length < 2 && !hasAdditive) {
        continue;
      }
      const itemId = item.getInstanceId();

      if (!this.layerMixerMap.has(itemId)) {
        this.layerMixerMap.set(itemId, new TransformLayerMixer());
        this.layerMixerItemIds.push(itemId);
        this.layerMixerItems.push(item);
      }
    }
  }

  private collectTransformTracks (track: TrackAsset, out: TransformTrack[]) {
    for (const child of track.getChildTracks()) {
      if (child instanceof TransformTrack) {
        out.push(child);
      }
      this.collectTransformTracks(child, out);
    }
  }

  private tickTrack (track: TrackInstance, deltaTime: number) {

    const context = track.output.context;

    context.deltaTime = deltaTime;
    context.layerMixerMap = this.layerMixerMap.size > 0 ? this.layerMixerMap : undefined;

    track.output.setUserData(track.boundObject);

    for (const clip of track.mixer.clipPlayables) {
      if (clip.getPlayState() === PlayState.Playing) {
        clip.processFrame(context);
      }
    }

    track.mixer.evaluate(context);

    for (const child of track.children) {
      this.tickTrack(child, deltaTime);
    }
  }

  private updateTrackAnimatedObject (trackInstance: TrackInstance) {
    for (const subTrack of trackInstance.children) {
      if (!subTrack.boundObject) {
        const boundObject = subTrack.trackAsset.updateAnimatedObject(trackInstance.boundObject);

        subTrack.boundObject = boundObject;
      }
      this.updateTrackAnimatedObject(subTrack);
    }
  }
}
