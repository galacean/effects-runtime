import * as spec from '@galacean/effects-specification';
import { VFX_ITEM_TYPE_TREE } from './constants';
import type { CameraController } from './plugins';
import { addItem } from './utils';
import type { VFXItemContent, VFXItemProps } from './vfx-item';
import { createVFXItem, VFXItem } from './vfx-item';
import type { Composition } from './composition';

export interface ItemNode {
  id: string, // item 的 id
  item: VFXItem<VFXItemContent>, // 对应的 vfxItem
  children: ItemNode[], // 子元素数组
  parentId?: string, // 当前时刻作用在 vfxItem 的 transform 上的 parentTransform 对应元素的 id，会随父元素的销毁等生命周期变换，与 vfxItem.parenId 可能不同
}

export class CompVFXItem extends VFXItem<void> {
  /**
   * 创建好的元素数组
   */
  items: VFXItem<VFXItemContent>[] = [];
  /**
   * 根据父子关系构建的元素树
   */
  itemTree: ItemNode[] = [];
  startTime: number;
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
  private extraCamera: VFXItem<CameraController>;

  override get type (): spec.ItemType {
    return spec.ItemType.composition;
  }

  override onConstructed (props: VFXItemProps) {
    const { items = [], startTime = 0 } = props;

    this.itemProps = items;
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
        const item = createVFXItem(this.itemProps[i], this.composition);

        if (item.id === 'extra-camera' && item.name === 'extra-camera') {
          this.extraCamera = item;
        }
        this.items.push(item);
        this.tempQueue.push(item);
      }
    }

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
        itemNode.item.onUpdate(dt);
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

    this.extraCamera && this.extraCamera.onUpdate(dt);
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
      if (item.type === VFX_ITEM_TYPE_TREE || item.type === spec.ItemType.null) {
        const willRemove = item.endBehavior === spec.END_BEHAVIOR_DESTROY_CHILDREN;
        const keepParent = item.type === spec.ItemType.null && !!this.itemCacheMap.get(item.id);
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
      let countTime = 0;

      while (queue.length) {
        countTime++;
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
}
