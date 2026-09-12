import * as spec from '@galacean/effects-specification';
import type { TrackAsset, TimelineAsset } from '../plugins';
import { TimelineInstance, PlayState } from '../plugins';
import { VFXItem } from '../vfx-item';
import { effectsClass } from '../decorators';
import { EventEmitter } from '../events';
import type { EventEmitterListener, EventEmitterOptions } from '../events';
import { Component } from './component';

export interface SceneBinding {
  key: TrackAsset,
  value: VFXItem,
}

export interface SceneBindingData {
  key: spec.DataPath,
  value: spec.DataPath,
}

export enum UpdateModes {
  EveryUpdate,
  Manual,
}

export type CompositionComponentEvent = {
  end: [CompositionComponent],
};

/**
 * @since 2.0.0
 */
@effectsClass('CompositionComponent')
export class CompositionComponent extends Component {
  items: VFXItem[] = [];  // 场景的所有元素
  /**
   * @internal
   */
  state: PlayState = PlayState.Stopped;
  /**
   * 更新模式，决定了组件更新时间的方式
   * - EveryUpdate：每帧自动更新，适用于大多数情况
   * - Manual：需要手动调用 tick 接口更新，适用于需要精确控制更新时间的情况
   */
  updateMode: UpdateModes = UpdateModes.EveryUpdate;

  playOnStart = false;

  speed = 1;
  /** Absolute start of the timeline, in seconds. */
  startTime = 0;
  isEnded = false;
  private isEndCalled = false;
  private readonly eventEmitter = new EventEmitter<CompositionComponentEvent>();

  private time = 0;
  private sceneBindings: SceneBinding[] = [];
  private timelineAsset: TimelineAsset | null = null;
  private _timelineInstance: TimelineInstance | null = null;
  private nestedCompositions: CompositionComponent[] = [];

  get endBehavior () {
    return this.item.endBehavior;
  }

  set endBehavior (value: spec.EndBehavior) {
    this.item.endBehavior = value;
  }

  private get timelineInstance (): TimelineInstance | null {
    this.initializeTimeline();

    return this._timelineInstance;
  }

  on<E extends keyof CompositionComponentEvent> (
    eventName: E,
    listener: EventEmitterListener<CompositionComponentEvent[E]>,
    options?: EventEmitterOptions,
  ) {
    this.eventEmitter.on(eventName, listener, options);
  }

  off<E extends keyof CompositionComponentEvent> (
    eventName: E,
    listener: EventEmitterListener<CompositionComponentEvent[E]>,
  ) {
    this.eventEmitter.off(eventName, listener);
  }

  override onAwake () {
    this.initializeTimeline();
  }

  private initializeTimeline () {
    if (!this._timelineInstance && this.timelineAsset) {
      this._timelineInstance = new TimelineInstance(this.timelineAsset, this.sceneBindings);

      this.nestedCompositions = [];

      // 收集所有嵌套预合成实例
      for (const masterTrack of this._timelineInstance.masterTrackInstances) {
        const boundObject = masterTrack.boundObject;

        if (boundObject instanceof VFXItem && VFXItem.isComposition(boundObject)) {
          const nestedComposition = boundObject.getComponent(CompositionComponent);

          this.nestedCompositions.push(nestedComposition);
        }
      }
    }
  }

  override onEnable () {
    this.item.getDescendants(false, item => {
      item.setActive(true);

      return false;
    });
  }

  override onDisable () {
    this.item.getDescendants(false, item => {
      item.setActive(false);

      return false;
    });
  }

  override onStart (): void {
    if (this.playOnStart) {
      this.play();
    }
  }

  pause () {
    this.state = PlayState.Paused;

    for (const subComposition of this.nestedCompositions) {
      subComposition.pause();
    }
  }

  play () {
    this.state = PlayState.Playing;

    for (const subComposition of this.nestedCompositions) {
      subComposition.play();
    }
  }

  stop () {
    this.state = PlayState.Stopped;
    this.time = this.startTime;
    this.resetEndState();

    for (const subComposition of this.nestedCompositions) {
      subComposition.stop();
    }
  }

  getTime () {
    return this.time;
  }

  setTime (time: number) {
    this.evaluateAt(time);
  }

  override onUpdate (dt: number): void {
    if (this.state !== PlayState.Playing) {
      return;
    }

    if (this.updateMode === UpdateModes.EveryUpdate) {
      this.tick(dt / 1000 * this.speed);
    }
  }

  tick (deltaTime: number) {
    this.evaluateAt(this.time + deltaTime);
  }

  /** Apply playback end behavior and sample the timeline without advancing other components. */
  evaluateAt (time: number) {
    if (!this.item) {
      return;
    }
    const previousTime = this.time;
    let localTime = time - this.startTime;

    if (time < previousTime && localTime < 0) {
      localTime = 0;
    }
    const duration = this.item.duration;
    const isEnded = localTime >= duration;

    if (this.isEnded !== isEnded) {
      this.isEndCalled = false;
    }
    this.isEnded = isEnded;

    if (isEnded) {
      switch (this.endBehavior) {
        case spec.EndBehavior.forward:

          break;
        case spec.EndBehavior.freeze:
          localTime = duration;

          break;
        case spec.EndBehavior.restart:
          localTime = duration > 0 ? localTime % duration : 0;
          if (duration > 0) {
            this.isEndCalled = false;
          }

          break;
        case spec.EndBehavior.destroy:
          break;
      }
    }

    this.sampleTime(localTime + this.startTime);
    if (this.isEnded) {
      this.emitEnd();
      if (this.item && this.endBehavior === spec.EndBehavior.destroy
        && this.item !== this.item.composition?.sceneRoot) {
        this.item.dispose();
      }
    }
  }

  private emitEnd () {
    if (!this.isEndCalled) {
      this.isEndCalled = true;
      this.eventEmitter.emit('end', this);
    }
  }

  /**
   * Sample an absolute timeline time in seconds, already mapped by the caller.
   * Parent clips own the playback range of nested compositions; do not apply
   * this component's standalone end behavior or update its end state here.
   * @internal
   */
  sampleTime (time: number) {
    const previousTime = this.time;

    this.timelineInstance?.evaluate(time, time - previousTime);
    this.time = time;
    if (this.updateMode === UpdateModes.EveryUpdate || this.item === this.item.composition?.sceneRoot) {
      this.setChildrenRenderOrder(0);
    }
  }

  /** @internal */
  resetEndState () {
    this.isEnded = false;
    this.isEndCalled = false;
  }

  /**
   * 设置当前合成子元素的渲染顺序
   *
   * 1. 按场景树递归（DFS）顺序遍历所有子元素，得到默认排序队列
   * 2. 收集队列中属于 masterTrackInstances 绑定的 item 及其坑位索引
   * 3. 按 masterTrackInstances 的顺序重新分配这些坑位，非 track 绑定的元素坑位不变
   * 4. 最终按调整后的队列依次分配 renderOrder
   *
   * @internal
   */
  setChildrenRenderOrder (startOrder: number): number {
    if (!this.timelineInstance) {
      return startOrder;
    }

    // 1. 场景树 DFS 顺序收集直接子元素
    const sceneOrder: VFXItem[] = [];

    this.collectChildren(this.item, sceneOrder);

    // 2. 构建 masterTrackInstances 绑定的 item 集合
    const trackedItems = new Set<VFXItem>();

    for (const masterTrack of this.timelineInstance.masterTrackInstances) {
      if (masterTrack.boundObject instanceof VFXItem) {
        trackedItems.add(masterTrack.boundObject);
      }
    }

    // 3. 收集 tracked items 在场景队列中的坑位索引
    const slotIndices: number[] = [];

    for (let i = 0; i < sceneOrder.length; i++) {
      if (trackedItems.has(sceneOrder[i])) {
        slotIndices.push(i);
      }
    }

    // 4. 按 masterTrackInstances 顺序取出 tracked items
    const sortedTrackedItems: VFXItem[] = [];

    for (const masterTrack of this.timelineInstance.masterTrackInstances) {
      if (masterTrack.boundObject instanceof VFXItem) {
        sortedTrackedItems.push(masterTrack.boundObject);
      }
    }

    // 5. 将排序后的 tracked items 填回原坑位
    for (let i = 0; i < slotIndices.length && i < sortedTrackedItems.length; i++) {
      sceneOrder[slotIndices[i]] = sortedTrackedItems[i];
    }

    // 6. 分配 renderOrder
    for (const child of sceneOrder) {
      const renderOrder = startOrder++;

      // 用户手动设置的 renderOrder 优先级最高，覆盖默认顺序
      if (!child.isManuallySetRenderOrder) {
        child.setRendererComponentOrder(renderOrder);
      }

      const subCompositionComponent = child.getComponent(CompositionComponent);

      if (subCompositionComponent) {
        startOrder = subCompositionComponent.setChildrenRenderOrder(startOrder);
      }
    }

    return startOrder;
  }

  /**
   * 递归收集场景树中的直接子元素（DFS 前序）
   */
  private collectChildren (item: VFXItem, result: VFXItem[]) {
    for (const child of item.children) {
      result.push(child);

      if (!VFXItem.isComposition(child)) {
        this.collectChildren(child, result);
      }
    }
  }

  override fromData (data: spec.CompositionComponentData): void {
    super.fromData(data);

    if (data.items !== undefined) {
      this.items = data.items.map(item => this.engine.findObject<VFXItem>(item));
    }
    if (data.sceneBindings !== undefined) {
      this.sceneBindings = data.sceneBindings.map(binding => ({
        key: this.engine.findObject<TrackAsset>(binding.key),
        value: this.engine.findObject<VFXItem>(binding.value),
      }));
    }
    if (data.timelineAsset !== undefined) {
      this.timelineAsset = this.engine.findObject<TimelineAsset>(data.timelineAsset);
    }

    this._timelineInstance = null;
  }
}
