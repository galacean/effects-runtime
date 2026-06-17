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
  private transformLayerMixerMap = new Map<string, TransformLayerMixer>();

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

    // 按 masterTrack（每个对应一个绑定 item）逐个就地处理：
    // reset → tick 整棵子树（收集该 item 全部 TransformTrack 贡献）→ flush 写回。
    // 就地 flush 保证 transform 在该 item tick 完即为最新值，与旧的逐 track 直写时序一致，
    // 避免父子层级 / 同 item 其他组件在 tick 期间读到陈旧 transform。
    for (const track of this.masterTrackInstances) {
      const boundItem = track.boundObject;
      const layerMixer = boundItem instanceof VFXItem
        ? this.transformLayerMixerMap.get(boundItem.getInstanceId())
        : undefined;

      layerMixer?.resetFrame();
      this.tickTrack(track, deltaTime);
      if (layerMixer && boundItem instanceof VFXItem) {
        layerMixer.flush(boundItem);
      }
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
      const transformTracks: TransformTrack[] = [];

      this.collectTransformTracks(sceneBinding.key, transformTracks);

      // 仅当同一 item 被 ≥2 条 TransformTrack 影响时才需要 layerMixer 做叠加合成。
      // 单 track（绝大多数场景）直接由 mixer 在 processFrame 阶段直写 transform，
      // 时序与旧实现一致，避免嵌套合成 / 父子继承读到滞后值。
      if (transformTracks.length < 2) {
        continue;
      }
      const item = sceneBinding.value;
      const itemId = item.getInstanceId();

      if (!this.transformLayerMixerMap.has(itemId)) {
        const layerMixer = new TransformLayerMixer();

        layerMixer.captureBasePose(item);
        this.transformLayerMixerMap.set(itemId, layerMixer);
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
    context.transformLayerMixerMap = this.transformLayerMixerMap.size > 0 ? this.transformLayerMixerMap : undefined;

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
