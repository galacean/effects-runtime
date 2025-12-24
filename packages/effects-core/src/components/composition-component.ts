import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import type { Composition, CompositionHitTestOptions } from '../composition';
import type { Region, TrackAsset } from '../plugins';
import { TimelineInstance, HitTestType, PlayState, TimelineAsset } from '../plugins';
import { noop } from '../utils';
import { VFXItem } from '../vfx-item';
import { effectsClass, serialize } from '../decorators';
import { Component } from './component';

export interface SceneBinding {
  key: TrackAsset,
  value: VFXItem,
}

export interface SceneBindingData {
  key: spec.DataPath,
  value: spec.DataPath,
}

/**
 * @since 2.0.0
 */
@effectsClass('CompositionComponent')
export class CompositionComponent extends Component {
  time = 0;
  @serialize()
  items: VFXItem[] = [];  // 场景的所有元素

  /**
   * @internal
   */
  state: PlayState = PlayState.Playing;

  private reusable = false;
  @serialize()
  private sceneBindings: SceneBinding[] = [];
  @serialize()
  private timelineAsset: TimelineAsset;
  private timelineInstance: TimelineInstance;

  override onStart (): void {
    if (!this.timelineAsset) {
      this.timelineAsset = new TimelineAsset(this.engine);
    }
    // this.resolveBindings();
    this.timelineInstance = new TimelineInstance(this.timelineAsset, this.sceneBindings);

    this.item.composition?.refContent.push(this.item);
  }

  getReusable () {
    return this.reusable;
  }

  pause () {
    this.state = PlayState.Paused;
  }

  resume () {
    this.state = PlayState.Playing;
  }

  override onUpdate (dt: number): void {
    if (this.state === PlayState.Paused) {
      return;
    }
    const time = this.time;

    this.timelineInstance.setTime(time);

    this.timelineInstance.evaluate(dt / 1000);
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
    }

    return hitTestSuccess;
  }

  /**
   * 设置当前合成子元素的渲染顺序
   * @internal
   */
  setChildrenRenderOrder (startOrder: number): number {
    for (const item of this.items) {
      item.renderOrder = startOrder++;

      const subCompositionComponent = item.getComponent(CompositionComponent);

      if (subCompositionComponent) {
        startOrder = subCompositionComponent.setChildrenRenderOrder(startOrder);
      }
    }

    return startOrder;
  }

  override fromData (data: any): void {
    super.fromData(data);
  }
}
