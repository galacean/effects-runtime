import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { Behaviour } from './components';
import type { CompositionHitTestOptions } from './composition';
import type { Region, TimelinePlayable, TrackAsset } from './plugins';
import { HitTestType } from './plugins';
import { PlayableGraph } from './plugins/cal/playable-graph';
import { TimelineAsset } from './plugins/timeline';
import { generateGUID, noop } from './utils';
import { VFXItem } from './vfx-item';
import { SerializationHelper } from './serialization-helper';

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
export class CompositionComponent extends Behaviour {
  time = 0;
  startTime = 0;
  items: VFXItem[] = [];  // 场景的所有元素

  private reusable = false;
  private sceneBindings: SceneBinding[] = [];
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

  override onUpdate (dt: number): void {
    const time = this.time;

    this.timelinePlayable.setTime(time);

    // The properties of the object may change dynamically,
    // so reset the track binding to avoid invalidation of the previously obtained binding object.
    // this.resolveBindings();
    this.timelinePlayable.evaluate();
    this.graph.evaluate(dt);
  }

  createContent () {
    if (this.item.composition) {
      for (const item of this.items) {
        item.composition = this.item.composition;

        // 设置预合成作为元素时的时长、结束行为和渲染延时
        if (VFXItem.isComposition(item)) {
          this.item.composition.refContent.push(item);
          const compositionContent = item.props.content as unknown as spec.CompositionContent;
          const refId = compositionContent.options.refId;
          const props = this.item.composition.refCompositionProps.get(refId);

          if (!props) {
            throw new Error(`Referenced precomposition with Id: ${refId} does not exist.`);
          }
          const compositionComponent = item.addComponent(CompositionComponent);

          SerializationHelper.deserialize(props as unknown as spec.EffectsObjectData, compositionComponent);
          compositionComponent.createContent();
          for (const vfxItem of compositionComponent.items) {
            vfxItem.setInstanceId(generateGUID());
            for (const component of vfxItem.components) {
              component.setInstanceId(generateGUID());
            }
          }
        }
      }
    }
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

    this.items = data.items;
    this.startTime = data.startTime ?? 0;
    this.sceneBindings = data.sceneBindings;
    this.timelineAsset = data.timelineAsset;
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
