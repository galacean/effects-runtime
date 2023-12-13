import { Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import type { Ray } from '@galacean/effects-math/es';
import * as spec from '@galacean/effects-specification';
import { CalculateItem, HitTestType } from './plugins';
import type { CameraVFXItem, Region } from './plugins';
import { addItem, noop } from './utils';
import type { VFXItemContent, VFXItemProps } from './vfx-item';
import { createVFXItem, Item, VFXItem } from './vfx-item';
import type { Composition, CompositionHitTestOptions } from './composition';

export interface ItemNode {
  id: string, // item 的 id
  item: VFXItem<VFXItemContent>, // 对应的 vfxItem
  children: ItemNode[], // 子元素数组
  parentId?: string, // 当前时刻作用在 vfxItem 的 transform 上的 parentTransform 对应元素的 id，会随父元素的销毁等生命周期变换，与 vfxItem.parenId 可能不同
}

export class CompVFXItem extends VFXItem<void | CalculateItem> {
  /**
   * 创建好的元素数组
   */
  items: VFXItem<VFXItemContent>[] = [];
  /**
   * 根据父子关系构建的元素树
   */
  itemTree: ItemNode[] = [];
  startTime: number;
  // k帧数据
  contentProps: any;
  override timeInms: number;
  /**
   * id和元素的映射关系Map，方便查找
   */
  public readonly itemCacheMap: Map<string, ItemNode> = new Map();

  private itemProps: VFXItemProps[];
  private freezeOnEnd: boolean;
  private startTimeInms: number;
  private itemsToRemove: VFXItem<VFXItemContent>[] = [];
  private tempQueue: VFXItem<VFXItemContent>[] = [];
  // 3D 模式下创建的场景相机 需要最后更新参数
  private extraCamera: CameraVFXItem;
  // 预合成的原始合成id
  private refId: string | undefined;

  override get type (): spec.ItemType {
    return spec.ItemType.composition;
  }

  override onConstructed (props: VFXItemProps) {
    const { items = [], startTime = 0, content, refId } = props;

    this.refId = refId;
    this.itemProps = items;
    this.contentProps = content;
    const endBehavior = this.endBehavior;

    if (
      endBehavior === spec.END_BEHAVIOR_RESTART ||
      endBehavior === spec.END_BEHAVIOR_PAUSE ||
      endBehavior === spec.END_BEHAVIOR_PAUSE_AND_DESTROY
    ) {
      this.freezeOnEnd = true;
    }

    this.startTime = startTime;
    this.startTimeInms = Math.round((this.startTime) * 1000);
  }

  override createContent () {
    /**
     * 创建前需要判断下是否存在，createContent会执行两次
     */
    if (!this.items.length && this.composition) {
      for (let i = 0; i < this.itemProps.length; i++) {
        let item: VFXItem<VFXItemContent>;
        const itemProps = this.itemProps[i];

        // 设置预合成作为元素时的时长、结束行为和渲染延时
        if (Item.isComposition(itemProps)) {
          const refId = itemProps.content.options.refId;
          const props = this.composition.refCompositionProps.get(refId);

          if (!props) {
            throw new Error(`引用的Id: ${refId} 的预合成不存在`);
          }
          props.content = itemProps.content;
          item = new CompVFXItem({
            ...props,
            refId,
            delay: itemProps.delay,
            id: itemProps.id,
            name: itemProps.name,
            duration: itemProps.duration,
            endBehavior: itemProps.endBehavior,
            parentId: itemProps.parentId,
            transform: itemProps.transform,
          }, this.composition);
          (item as CompVFXItem).contentProps = itemProps.content;
          item.transform.parentTransform = this.transform;
          this.composition.refContent.push(item as CompVFXItem);
          if (item.endBehavior === spec.END_BEHAVIOR_RESTART) {
            this.composition.autoRefTex = false;
          }
        } else {
          item = createVFXItem(this.itemProps[i], this.composition);
          item.transform.parentTransform = this.transform;
        }

        if (VFXItem.isExtraCamera(item)) {
          this.extraCamera = item;
        }
        this.items.push(item);
        this.tempQueue.push(item);
      }
    }
    // TODO: 处理k帧数据, ECS后改成 TimelineComponent
    if (!this.content && this.contentProps) {
      this._content = this.doCreateContent();
    }
  }

  protected override doCreateContent (): CalculateItem {
    const content: CalculateItem = new CalculateItem(this.contentProps, this);

    content.renderData = content.getRenderData(0, true);

    return content;
  }

  override onLifetimeBegin () {
    this.items?.forEach(item => {
      item.start();
      item.createContent();
    });
    this.buildItemTree();
  }

  override doStop () {
    if (this.items) {
      this.items.forEach(item => item.stop());
    }
  }

  override onItemUpdate (dt: number, lifetime: number) {
    if (this.content) {
      this.content.updateTime(this.time);
      this.content.getRenderData(this.content.time);
    }
    if (!this.items) {
      return;
    }
    // 更新 model-tree-plugin
    this.composition?.updatePluginLoaders(dt);
    const queue: ItemNode[] = [];

    /**
     * 元素销毁时，重新设置其子元素的父元素
     */
    if (this.itemsToRemove.length) {
      this.itemsToRemove.forEach(item => {
        const itemNode = this.itemCacheMap.get(item.id) as ItemNode;

        if (!itemNode) {
          return;
        }
        const children = itemNode.children;

        // 如果有父元素，设置当前元素的子元素的父元素为父元素，以便继承变换
        if (itemNode.parentId) {
          const parentNode = this.itemCacheMap.get(itemNode.parentId);

          if (parentNode) {
            parentNode.children.splice(parentNode.children.indexOf(itemNode), 1);
            children.forEach(child => this.setItemParent(child.item, parentNode.item));
          } else {
            children.forEach(child => this.setItemParent(child.item, undefined));
            this.itemTree.push(...children);
          }
          // 否则直接设置当前元素的子元素的父元素为合成
        } else {
          this.itemTree.splice(this.itemTree.indexOf(itemNode), 1, ...children);
          children.forEach(child => this.setItemParent(child.item, undefined));
        }

        this.itemCacheMap.delete(item.id);
        this.items.splice(this.items.indexOf(item), 1);
      });
      this.itemsToRemove.length = 0;
    }

    /**
     * 避免 slice 操作，先遍历第一层
     */
    for (let i = 0; i < this.itemTree.length; i++) {
      const itemNode = this.itemTree[i];

      if (itemNode && itemNode.item) {
        const item = itemNode.item;

        if (
          VFXItem.isComposition(item) &&
          item.ended &&
          item.endBehavior === spec.END_BEHAVIOR_RESTART
        ) {
          item.restart();
        } else {
          item.onUpdate(dt);
        }
        queue.push(...itemNode.children);
      }
    }
    while (queue.length) {
      const itemNode = queue.shift();

      if (itemNode && itemNode.item) {
        const item = itemNode.item;

        item.onUpdate(dt);
        queue.push(...itemNode.children);
        if (!item.composition) {
          addItem(this.itemsToRemove, item);
        }
      }
    }

    this.extraCamera?.onUpdate(dt);
  }

  override onItemRemoved (composition: Composition) {
    if (this.items) {
      this.items.forEach(item => item.dispose());
      this.items.length = 0;
      this.itemTree.length = 0;
      this.itemCacheMap.clear();
    }
  }
  override reset () {
    super.reset();
    this.itemTree = [];
    this.itemCacheMap.clear();
    this.tempQueue.length = 0;
    this.itemsToRemove.length = 0;
  }

  override handleVisibleChanged (visible: boolean) {
    this.items.forEach(item => item.setVisible(visible));
  }

  getUpdateTime (t: number) {
    const startTime = this.startTimeInms;
    const now = this.timeInms;

    if (t < 0 && (now + t) < startTime) {
      return startTime - now;
    }
    if (this.freezeOnEnd) {
      const remain = this.durInms - now;

      if (remain < t) {
        return remain;
      }
    }

    return t;
  }

  removeItem (item: VFXItem<VFXItemContent>) {
    const itemIndex = this.items.indexOf(item);

    if (itemIndex > -1) {
      addItem(this.itemsToRemove, item);
      if (VFXItem.isTree(item) || VFXItem.isNull(item)) {
        const willRemove = item.endBehavior === spec.END_BEHAVIOR_DESTROY_CHILDREN;
        const keepParent = VFXItem.isNull(item) && !!this.itemCacheMap.get(item.id);
        const children = this.itemCacheMap.get(item.id)?.children || [];

        children.forEach(cit => {
          if (!keepParent) {
            this.setItemParent(cit.item, undefined);
          }
          willRemove && this.removeItem(cit.item);
        });
      }

      return true;
    }

    this.items.forEach(it => {
      if (VFXItem.isComposition(it)) {
        const itemIndex = it.items.indexOf(item);

        if (itemIndex > -1) {
          it.removeItem(item);

          return true;
        }
      }
    });

    return false;
  }

  /**
   * 设置指定元素的父元素
   * @param item
   * @param parentItem - 为 undefined 时表示设置父变换为合成的变换
   */
  setItemParent (item: VFXItem<VFXItemContent>, parentItem?: VFXItem<VFXItemContent>) {

    const itemNode = this.itemCacheMap.get(item.id);

    if (!itemNode) {
      console.error('item has been remove, please set item\'s parent in valid lifetime');

      return;
    } else {
      if (!parentItem) {
        itemNode.parentId = undefined;
        item.parent = undefined;
        item.transform.parentTransform = this.transform;
      } else {
        const parentNode = this.itemCacheMap.get(parentItem.id) as ItemNode;

        if (itemNode.parentId) {
          const originalParent = this.itemCacheMap.get(itemNode.parentId) as ItemNode;

          originalParent.children.splice(originalParent.children.indexOf(itemNode), 1);
        }
        item.parent = parentItem;
        itemNode.parentId = parentItem.id;
        parentNode.children.push(itemNode);
        item.transform.parentTransform = parentItem.transform;
      }
    }
  }

  /**
   * 获取指定元素当前时刻真正起作用的父元素, 需要在元素生命周期内获取
   * @internal
   * @param item - 指定元素
   * @return 当父元素生命周期结束时，返回空
   */
  getItemCurrentParent (item: VFXItem<VFXItemContent>): VFXItem<VFXItemContent> | void {
    const id = item.id;
    const itemNode = this.itemCacheMap.get(id);

    if (!itemNode) {
      return;
    }
    const parentId = itemNode.parentId;

    if (!parentId) {
      return;
    }
    const parentNode = this.itemCacheMap.get(parentId);

    if (parentId && parentNode) {
      return parentNode.item;
    }

  }

  getItemByName (name: string) {
    const res: VFXItem<VFXItemContent>[] = [];

    for (const item of this.items) {
      if (item.name === name) {
        res.push(item);
      } else if (VFXItem.isComposition(item)) {
        res.push(...item.getItemByName(name));
      }
    }

    return res;
  }

  hitTest (ray: Ray, x: number, y: number, regions: Region[], force?: boolean, options?: CompositionHitTestOptions): Region[] {
    const hitPositions: Vector3[] = [];
    const stop = options?.stop || noop;
    const skip = options?.skip || noop;
    const maxCount = options?.maxCount || this.items.length;

    for (let i = 0; i < this.items.length && regions.length < maxCount; i++) {
      const item = this.items[i];

      if (item.lifetime >= 0 && item.lifetime <= 1 && !VFXItem.isComposition(item) && !skip(item)) {
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
              compContent: this,
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

  protected override isEnded (now: number) {
    return now >= this.durInms;
  }

  /**
   * 构建父子树，同时保存到 itemCacheMap 中便于查找
   */
  private buildItemTree () {
    if (!this.itemTree.length && this.composition) {
      this.itemTree = [];
      const itemMap = this.itemCacheMap;
      const queue = this.tempQueue;

      while (queue.length) {
        const item = queue.shift() as VFXItem<VFXItemContent>;

        if (item.parentId === undefined) {
          const itemNode = {
            id: item.id,
            item,
            children: [],
          };

          this.itemTree.push(itemNode);
          itemMap.set(item.id, itemNode);
        } else {
          // 兼容 treeItem 子元素的 parentId 带 '^'
          const parentId = this.getParentIdWithoutSuffix(item.parentId);
          const parent = itemMap.get(parentId);

          if (parent) {
            const itemNode = {
              id: item.id,
              parentId,
              item,
              children: [],
            };

            item.parent = parent.item;
            item.transform.parentTransform = parent.item.getNodeTransform(item.parentId);

            parent.children.push(itemNode);
            itemMap.set(item.id, itemNode);
          } else {
            if (this.items.findIndex(item => item.id === parentId) === -1) {
              throw Error('元素引用了不存在的元素，请检查数据');
            }
            queue.push(item);
          }
        }
      }
    }
  }
  private getParentIdWithoutSuffix (id: string) {
    const idx = id.lastIndexOf('^');

    return idx > -1 ? id.substring(0, idx) : id;
  }

  private restart () {
    this.reset();
    this.createContent();
    this.start();
  }
}
