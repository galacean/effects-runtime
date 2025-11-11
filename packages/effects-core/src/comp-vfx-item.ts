import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type * as spec from '@galacean/effects-specification';
import { Component } from './components';
import type { Composition, CompositionHitTestOptions } from './composition';
import type { Region, TrackAsset } from './plugins';
import { TimelineInstance } from './plugins';
import { HitTestType } from './plugins';
import { PlayState } from './plugins/timeline/playable';
import { TimelineAsset } from './plugins/timeline';
import { noop } from './utils';
import { VFXItem } from './vfx-item';
import { effectsClass, serialize } from './decorators';

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
    for (const item of this.items) {
      item.setActive(true);
    }
  }

  override onDisable () {
    for (const item of this.items) {
      item.setActive(false);
    }
  }

  override onDestroy (): void {
    if (this.item.composition) {
      if (this.items) {
        this.items.forEach(item => item.dispose());
        this.items.length = 0;
      }
    }
  }

  hitTest (
    ray: Ray,
    x: number,
    y: number,
    regions: Region[],
    force?: boolean,
    options?: CompositionHitTestOptions,
  ): Region[] {
    const hitPositions: Vector3[] = [];
    const stop = options?.stop || noop;
    const skip = options?.skip || noop;
    const maxCount = options?.maxCount || this.items.length;

    for (let i = 0; i < this.items.length && regions.length < maxCount; i++) {
      const item = this.items[i];

      if (
        item.isActive
        && item.transform.getValid()
        && !VFXItem.isComposition(item)
        && !skip(item)
      ) {
        const hitParams = item.getHitTestParams(force);

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
              compContent: this.item,
              id: item.id,
              name: item.name,
              position: hitPositions[hitPositions.length - 1],
              parentId: item.parentId,
              hitPositions,
              behavior: hitParams.behavior,
              item,
              composition: this.item.composition as Composition,
            };

            regions.push(region);

            if (stop(region)) {
              return regions;
            }
          }
        }
      }
    }

    return regions;
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
