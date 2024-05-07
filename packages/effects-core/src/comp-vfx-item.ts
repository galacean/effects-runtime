import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { ItemBehaviour } from './components';
import type { CompositionHitTestOptions } from './composition';
import type { Region } from './plugins';
import { HitTestType, TimelineComponent } from './plugins';
import { generateGUID, noop } from './utils';
import type { VFXItemContent } from './vfx-item';
import { Item, VFXItem, createVFXItem } from './vfx-item';
import { Transform } from './transform';

/**
 * @since 2.0.0
 * @internal
 */
export class CompositionComponent extends ItemBehaviour {
  startTime: number;
  refId: string;
  items: VFXItem<VFXItemContent>[] = [];  // 场景的所有元素
  timelineComponents: TimelineComponent[];
  timelineComponent: TimelineComponent;

  override start (): void {
    const item = this.item;
    const { startTime = 0 } = item.props;

    this.startTime = startTime;
    this.timelineComponents = [];
    this.timelineComponent = this.item.getComponent(TimelineComponent)!;

    for (const item of this.items) {
      // 获取所有的合成元素 Timeline 组件
      const timeline = item.getComponent(TimelineComponent);

      if (timeline) {
        this.timelineComponents.push(timeline);
        // 重播不销毁元素
        if (
          this.item.endBehavior !== spec.ItemEndBehavior.destroy ||
          this.timelineComponent.reusable
        ) {
          timeline.reusable = true;
        }
      }
    }
  }

  override update (dt: number): void {
    const time = this.timelineComponent.getTime();

    for (const timeline of this.timelineComponents) {
      // TODO 统一时间为 s
      const localTime = timeline.toLocalTime(time);

      timeline.setTime(localTime);
    }
  }

  /**
   * 重置元素状态属性
   */
  resetStatus () {
    this.item.ended = false;
    this.item.delaying = true;
  }

  createContent () {
    const items = this.items;

    this.items.length = 0;
    if (this.item.composition) {
      const assetLoader = this.item.engine.assetLoader;
      const itemProps = this.item.props.items ? this.item.props.items : [];

      for (let i = 0; i < itemProps.length; i++) {
        let item: VFXItem<any>;
        const itemData = itemProps[i];

        // 设置预合成作为元素时的时长、结束行为和渲染延时
        if (Item.isComposition(itemData)) {
          const refId = itemData.content.options.refId;
          const props = this.item.composition.refCompositionProps.get(refId);

          if (!props) {
            throw new Error(`引用的Id: ${refId} 的预合成不存在`);
          }
          // endBehaviour 类型需优化
          props.content = itemData.content;
          item = new VFXItem(this.engine, {
            ...props,
            ...itemData,
            // TODO: 2.0 编辑器测试代码，后续移除
            // oldId: itemData.oldId,
          });
          // TODO 编辑器数据传入 composition type 后移除
          item.type = spec.ItemType.composition;
          item.composition = this.item.composition;
          item.addComponent(CompositionComponent).refId = refId;
          item.transform.parentTransform = this.transform;
          this.item.composition.refContent.push(item);
          if (item.endBehavior === spec.ItemEndBehavior.loop) {
            this.item.composition.autoRefTex = false;
          }
          item.getComponent(CompositionComponent)!.createContent();
          for (const vfxItem of item.getComponent(CompositionComponent)!.items) {
            vfxItem.setInstanceId(generateGUID());
            for (const component of vfxItem.components) {
              component.setInstanceId(generateGUID());
            }
          }
        } else if (
          //@ts-expect-error
          itemData.type === 'ECS' ||
          itemData.type === spec.ItemType.sprite ||
          itemData.type === spec.ItemType.text ||
          itemData.type === spec.ItemType.particle ||
          itemData.type === spec.ItemType.mesh ||
          itemData.type === spec.ItemType.skybox ||
          itemData.type === spec.ItemType.light ||
          itemData.type === 'camera' ||
          itemData.type === spec.ItemType.tree ||
          itemData.type === spec.ItemType.interact ||
          itemData.type === spec.ItemType.camera
        ) {
          item = assetLoader.loadGUID(itemData.id);
          item.composition = this.item.composition;
        } else {
          // TODO: 兼容 ECS 和老代码改造完成后，老代码可以下 @云垣
          item = new VFXItem(this.engine, itemData);
          item.composition = this.item.composition;
          // 兼容老的数据代码，json 更新后可移除
          item = createVFXItem(itemData, this.item.composition);

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

  override onDestroy (): void {
    if (this.item.composition) {
      if (this.items) {
        this.items.forEach(item => item.dispose());
        this.items.length = 0;
      }
    }
  }

  hitTest (ray: Ray, x: number, y: number, regions: Region[], force?: boolean, options?: CompositionHitTestOptions): Region[] {
    const hitPositions: Vector3[] = [];
    const stop = options?.stop || noop;
    const skip = options?.skip || noop;
    const maxCount = options?.maxCount || this.items.length;

    for (let i = 0; i < this.items.length && regions.length < maxCount; i++) {
      const item = this.items[i];

      if (item.lifetime >= 0 && !item.ended && !VFXItem.isComposition(item) && !skip(item)) {
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
}
