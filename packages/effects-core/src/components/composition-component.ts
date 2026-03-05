import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import type { Composition, CompositionHitTestOptions } from '../composition';
import type { Region, TrackAsset, TimelineAsset } from '../plugins';
import { TimelineInstance, HitTestType, PlayState } from '../plugins';
import { noop } from '../utils';
import { VFXItem } from '../vfx-item';
import { effectsClass, serialize } from '../decorators';
import { Component } from './component';
import { decimalEqual } from '../math';

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

/**
 * @since 2.0.0
 */
@effectsClass('CompositionComponent')
export class CompositionComponent extends Component {
  @serialize()
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

  endBehavior = spec.EndBehavior.forward;

  private reusable = false;
  private time = 0;
  private lastTime = 0;
  @serialize()
  private sceneBindings: SceneBinding[] = [];
  @serialize()
  private timelineAsset: TimelineAsset | null = null;
  private _timelineInstance: TimelineInstance | null = null;
  private nestedCompositions: CompositionComponent[] = [];

  private get timelineInstance (): TimelineInstance | null {
    if (!this._timelineInstance && this.timelineAsset) {
      this._timelineInstance = new TimelineInstance(this.timelineAsset, this.sceneBindings);
    }

    return this._timelineInstance;
  }

  override onStart (): void {
    if (this.timelineInstance) {
      for (const masterTrack of this.timelineInstance.masterTrackInstances) {
        const boundObject = masterTrack.boundObject;

        if (boundObject instanceof VFXItem && VFXItem.isComposition(boundObject)) {
          this.nestedCompositions.push(boundObject.getComponent(CompositionComponent));
        }
      }
    }

    for (const nestedComposition of this.nestedCompositions) {
      nestedComposition.updateMode = UpdateModes.Manual;
    }

    if (this.playOnStart) {
      this.play();
    }
  }

  getReusable () {
    return this.reusable;
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
    this.time = 0;
    this.lastTime = 0;

    for (const subComposition of this.nestedCompositions) {
      subComposition.stop();
    }
  }

  getTime () {
    return this.time;
  }

  setTime (time: number) {
    this.time = time;
  }

  override onUpdate (dt: number): void {
    if (this.state !== PlayState.Playing) {
      return;
    }

    if (this.updateMode === UpdateModes.EveryUpdate) {
      this.tick(dt / 1000);
    }
  }

  tick (deltaTime: number) {
    if (!this.timelineInstance) {
      return;
    }

    let time = this.time;

    if (decimalEqual(this.lastTime, this.time)) {
      time += deltaTime;
    }

    if (time > this.item.duration) {
      switch (this.endBehavior) {
        case spec.EndBehavior.forward:

          break;
        case spec.EndBehavior.freeze:
          time = this.item.duration;

          break;
        case spec.EndBehavior.restart:
          time = time % this.item.duration;

          break;
        case spec.EndBehavior.destroy:
          this.item.dispose();

          return;
      }
    }

    this.timelineInstance.evaluate(time, deltaTime);

    this.lastTime = this.time = time;
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

  override onDestroy (): void {
    const items = this.item.getDescendants();

    items.forEach(item => item.dispose());
  }

  hitTest (
    ray: Ray,
    x: number,
    y: number,
    regions: Region[],
    force?: boolean,
    options?: CompositionHitTestOptions,
  ): boolean {
    const isHitTestSuccess = this.hitTestRecursive(this.item, ray, x, y, regions, force, options);

    // 子元素碰撞测试成功加入当前预合成元素，判断是否是合成根元素，根元素不加入
    if (isHitTestSuccess && this.item !== this.item.composition?.rootItem) {
      const item = this.item;
      const lastRegion = regions[regions.length - 1];
      const hitPositions: Vector3[] = lastRegion.hitPositions;

      const region = {
        id: item.getInstanceId(),
        name: item.name,
        position: hitPositions[hitPositions.length - 1],
        parentId: item.parentId,
        hitPositions,
        behavior: spec.InteractBehavior.NONE,
        item: item,
        composition: item.composition as Composition,
      };

      regions.push(region);
    }

    return isHitTestSuccess;
  }

  private hitTestRecursive (
    item: VFXItem,
    ray: Ray,
    x: number,
    y: number,
    regions: Region[],
    force?: boolean,
    options?: CompositionHitTestOptions
  ): boolean {
    const hitPositions: Vector3[] = [];
    const stop = options?.stop || noop;
    const skip = options?.skip || noop;
    const maxCount = options?.maxCount;

    if (maxCount !== undefined && regions.length >= maxCount) {
      return false;
    }

    let hitTestSuccess = false;

    for (const hitTestItem of item.children) {
      if (
        hitTestItem.isActive
        && hitTestItem.transform.getValid()
        && !skip(hitTestItem)
      ) {
        const hitParams = hitTestItem.getHitTestParams(force);

        if (hitParams) {
          let success = false;
          const intersectPoint = new Vector3();

          if (hitParams.type === HitTestType.triangle) {

            const { triangles, backfaceCulling } = hitParams;

            for (let j = 0; j < triangles.length; j++) {
              const triangle = triangles[j];

              if (ray.intersectTriangle(triangle, intersectPoint, backfaceCulling)) {
                success = true;
                hitPositions.push(intersectPoint);

                break;
              }
            }
          } else if (hitParams.type === HitTestType.box) {
            const { center, size } = hitParams;
            const boxMin = center.clone().addScaledVector(size, 0.5);
            const boxMax = center.clone().addScaledVector(size, -0.5);

            if (ray.intersectBox({ min: boxMin, max: boxMax }, intersectPoint)) {
              success = true;
              hitPositions.push(intersectPoint);
            }
          } else if (hitParams.type === HitTestType.sphere) {
            const { center, radius } = hitParams;

            if (ray.intersectSphere({ center, radius }, intersectPoint)) {
              success = true;
              hitPositions.push(intersectPoint);
            }
          } else if (hitParams.type === HitTestType.custom) {
            const tempPosition = hitParams.collect(ray, new Vector2(x, y));

            if (tempPosition && tempPosition.length > 0) {
              tempPosition.forEach(pos => {
                hitPositions.push(pos);
              });
              success = true;
            }
          }
          if (success) {
            const region = {
              id: hitTestItem.getInstanceId(),
              name: hitTestItem.name,
              position: hitPositions[hitPositions.length - 1],
              parentId: hitTestItem.parentId,
              hitPositions,
              behavior: hitParams.behavior,
              item: hitTestItem,
              composition: this.item.composition as Composition,
            };

            regions.push(region);
            hitTestSuccess = true;

            if (stop(region)) {
              return true;
            }
          }
        }
      }

      if (VFXItem.isComposition(hitTestItem)) {
        if (hitTestItem.getComponent(CompositionComponent).hitTest(ray, x, y, regions, force, options)) {
          hitTestSuccess = true;
        }
      } else {
        if (this.hitTestRecursive(hitTestItem, ray, x, y, regions, force, options)) {
          hitTestSuccess = true;
        }
      }
    }

    return hitTestSuccess;
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

  override fromData (data: any): void {
    super.fromData(data);
  }
}
