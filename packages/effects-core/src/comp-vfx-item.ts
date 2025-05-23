import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { Component } from './components';
import type { CompositionHitTestOptions } from './composition';
import type { Region, TimelinePlayable, TrackAsset } from './plugins';
import { HitTestType } from './plugins';
import { PlayState, PlayableGraph } from './plugins/cal/playable-graph';
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
  startTime = 0;
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
  private timelinePlayable: TimelinePlayable;
  private graph: PlayableGraph = new PlayableGraph();

  override onStart (): void {
    if (!this.timelineAsset) {
      this.timelineAsset = new TimelineAsset(this.engine);
    }
    this.resolveBindings();
    this.timelinePlayable = this.timelineAsset.createPlayable(this.graph) as TimelinePlayable;

    // 重播不销毁元素
    if (this.item.endBehavior !== spec.EndBehavior.destroy) {
      this.setReusable(true);
    }

    this.item.composition?.refContent.push(this.item);
  }

  setReusable (value: boolean) {
    for (const track of this.timelineAsset.tracks) {
      const boundObject = track.boundObject;

      if (boundObject instanceof VFXItem) {
        const subCompositionComponent = boundObject.getComponent(CompositionComponent);

        if (subCompositionComponent) {
          subCompositionComponent.setReusable(value);
        }
      }
    }
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

    this.timelinePlayable.setTime(time);

    // The properties of the object may change dynamically,
    // so reset the track binding to avoid invalidation of the previously obtained binding object.
    this.resolveBindings();
    this.timelinePlayable.evaluate();
    this.graph.evaluate(dt);
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
            };

            // 触发单个元素的点击事件
            item.emit('click', region);

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
    const compositionData = data as spec.CompositionData;

    this.startTime = compositionData.startTime ?? 0;
  }

  private resolveBindings () {
    for (const sceneBinding of this.sceneBindings) {
      sceneBinding.key.boundObject = sceneBinding.value;
    }

    // 为了通过帧对比，需要保证和原有的 update 时机一致。
    // 因此这边更新一次对象绑定，后续 timeline playable 中 sort tracks 的排序才能和原先的版本对上。
    // 如果不需要严格保证和之前的 updata 时机一致，这边的更新和 timeline asset 中的 sortTracks 都能去掉。
    for (const masterTrack of this.timelineAsset.tracks) {
      this.updateTrackAnimatedObject(masterTrack);
    }
  }

  private updateTrackAnimatedObject (track: TrackAsset) {
    for (const subTrack of track.getChildTracks()) {
      subTrack.updateAnimatedObject();

      this.updateTrackAnimatedObject(subTrack);
    }
  }
}
