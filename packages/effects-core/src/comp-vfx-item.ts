import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { Behaviour } from './components';
import type { CompositionHitTestOptions } from './composition';
import type { ContentOptions } from './composition-source-manager';
import type { Region, TrackAsset } from './plugins';
import { HitTestType, ObjectBindingTrack } from './plugins';
import type { Playable } from './plugins/cal/playable-graph';
import { PlayableGraph } from './plugins/cal/playable-graph';
import { TimelineAsset } from './plugins/cal/timeline-asset';
import { Transform } from './transform';
import { generateGUID, noop } from './utils';
import { Item, VFXItem } from './vfx-item';

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
  refId: string;
  items: VFXItem[] = [];  // 场景的所有元素
  data: ContentOptions;

  private reusable = false;
  private sceneBindings: SceneBinding[] = [];
  private timelineAsset: TimelineAsset;
  private timelinePlayable: Playable;
  private graph: PlayableGraph = new PlayableGraph();

  override onStart (): void {
    const { startTime = 0 } = this.item.props;

    this.startTime = startTime;
    this.resolveBindings();
    this.timelinePlayable = this.timelineAsset.createPlayable(this.graph);

    // 重播不销毁元素
    if (this.item.endBehavior !== spec.EndBehavior.destroy) {
      this.setReusable(true);
    }
  }

  setReusable (value: boolean) {
    for (const track of this.timelineAsset.tracks) {
      const binding = track.binding;

      if (binding instanceof VFXItem) {
        if (track instanceof ObjectBindingTrack) {
          binding.reusable = value;
        }
        const subCompositionComponent = binding.getComponent(CompositionComponent);

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
    this.graph.evaluate(dt);
  }

  createContent () {
    const sceneBindings = [];

    for (const sceneBindingData of this.data.sceneBindings) {
      sceneBindings.push({
        key: this.engine.assetLoader.loadGUID<TrackAsset>(sceneBindingData.key.id),
        value: this.engine.assetLoader.loadGUID<VFXItem>(sceneBindingData.value.id),
      });
    }
    this.sceneBindings = sceneBindings;
    const timelineAsset = this.data.timelineAsset ? this.engine.assetLoader.loadGUID<TimelineAsset>(this.data.timelineAsset.id) : new TimelineAsset(this.engine);

    this.timelineAsset = timelineAsset;
    const items = this.items;

    this.items.length = 0;
    if (this.item.composition) {
      const assetLoader = this.item.engine.assetLoader;
      const itemProps = this.data.items ? this.data.items : [];

      for (let i = 0; i < itemProps.length; i++) {
        let item: VFXItem;
        const itemData = itemProps[i];

        // 设置预合成作为元素时的时长、结束行为和渲染延时
        if (Item.isComposition(itemData)) {
          const refId = itemData.content.options.refId;
          const props = this.item.composition.refCompositionProps.get(refId);

          if (!props) {
            throw new Error(`Referenced precomposition with Id: ${refId} does not exist.`);
          }
          // endBehavior 类型需优化
          props.content = itemData.content;
          item = assetLoader.loadGUID(itemData.id);
          item.composition = this.item.composition;

          const compositionComponent = new CompositionComponent(this.engine);

          compositionComponent.item = item;
          item.components.push(compositionComponent);
          compositionComponent.data = props as unknown as ContentOptions;
          compositionComponent.refId = refId;
          item.transform.parentTransform = this.transform;
          this.item.composition.refContent.push(item);
          if (item.endBehavior === spec.EndBehavior.restart) {
            this.item.composition.autoRefTex = false;
          }
          compositionComponent.createContent();
          for (const vfxItem of compositionComponent.items) {
            vfxItem.setInstanceId(generateGUID());
            for (const component of vfxItem.components) {
              component.setInstanceId(generateGUID());
            }
          }
        } else {
          item = assetLoader.loadGUID(itemData.id);
          item.composition = this.item.composition;
        }
        item.parent = this.item;
        // 相机不跟随合成移动
        item.transform.parentTransform = itemData.type === spec.ItemType.camera ? new Transform() : this.transform;
        if (VFXItem.isExtraCamera(item)) {
          this.item.composition.extraCamera = item;
        }
        items.push(item);
      }
    }
  }

  showItems () {
    for (const item of this.items) {
      item.setVisible(true);
    }
  }

  hideItems () {
    for (const item of this.items) {
      item.setVisible(false);
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
        item.getVisible()
        && item.transform.getValid()
        && !item.ended
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

  override fromData (data: unknown): void {
  }

  private resolveBindings () {
    for (const sceneBinding of this.sceneBindings) {
      sceneBinding.key.binding = sceneBinding.value;
    }
    for (const masterTrack of this.timelineAsset.tracks) {
      this.resolveTrackBindingsWithRoot(masterTrack);
    }
  }

  private resolveTrackBindingsWithRoot (track: TrackAsset) {
    for (const subTrack of track.getChildTracks()) {
      subTrack.binding = subTrack.resolveBinding(track.binding);

      this.resolveTrackBindingsWithRoot(subTrack);
    }
  }
}
