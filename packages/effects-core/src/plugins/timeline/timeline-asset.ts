import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../decorators';
import { VFXItem } from '../../vfx-item';
import type { RuntimeClip, TrackAsset } from './track';
import { ObjectBindingTrack } from './tracks';
import { PlayState } from './playable';
import type { Playable } from './playable';
import type { Constructor } from '../../utils';
import { TrackInstance } from './track-instance';
import type { SceneBinding } from '../../components';
import { EffectsObject } from '../../effects-object';

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

  private time = 0;
  private clips: RuntimeClip[] = [];
  private playableMap: Record<string, Playable[]> = {};

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

  setTime (time: number) {
    this.time = time;
  }

  getTime () {
    return this.time;
  }

  evaluate (deltaTime: number) {
    const time = this.getTime();

    // TODO search active clips

    for (const clip of this.clips) {
      clip.evaluateAt(time);
    }

    for (const track of this.masterTrackInstances) {
      this.tickTrack(track, deltaTime);
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

    // Build playable map for quick lookup by VFXItem id
    this.buildPlayableMap();
  }

  private tickTrack (track: TrackInstance, deltaTime: number) {

    const context = track.output.context;

    context.deltaTime = deltaTime;

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

  /**
   * 构建 VFXItem id 到 Playable 的映射表
   * @internal
   */
  private buildPlayableMap () {
    this.playableMap = {};

    for (const trackInstance of this.masterTrackInstances) {
      this.collectPlayables(trackInstance);
    }
  }

  /**
   * 递归收集所有 Playable 并建立映射
   * @internal
   */
  private collectPlayables (trackInstance: TrackInstance) {
    const boundObject = trackInstance.boundObject;

    if (boundObject instanceof VFXItem) {
      const itemId = boundObject.getInstanceId();

      if (!this.playableMap[itemId]) {
        this.playableMap[itemId] = [];
      }

      // 收集该轨道的所有 Playable
      for (const clipPlayable of trackInstance.mixer.clipPlayables) {
        this.playableMap[itemId].push(clipPlayable);
      }
    }

    // 递归处理子轨道
    for (const child of trackInstance.children) {
      this.collectPlayables(child);
    }
  }

  /**
   * 通过 VFXItem 的 id 获取对应的 Playable 数组
   * @param itemId - VFXItem 的实例 id
   * @returns Playable 数组，如果没有找到则返回空数组
   */
  getPlayablesByItemId (itemId: string): Playable[] {
    return this.playableMap[itemId] || [];
  }

  /**
   * 通过 VFXItem 的 id 获取指定类型的 Playable
   * @param itemId - VFXItem 的实例 id
   * @param playableType - Playable 的类型构造函数
   * @returns 指定类型的 Playable 数组，如果没有找到则返回空数组
   */
  getPlayablesByItemIdAndType<T extends Playable> (itemId: string, playableType: new (...args: any[]) => T): T[] {
    const playables = this.getPlayablesByItemId(itemId);

    return playables.filter(playable => playable instanceof playableType) as T[];
  }
}
