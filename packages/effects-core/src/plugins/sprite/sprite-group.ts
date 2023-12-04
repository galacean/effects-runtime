import type { Disposable } from '../../utils';
import { addItem, addItemWithOrder, removeItem, DestroyOptions } from '../../utils';
import type { VFXItemContent } from '../../vfx-item';
import { VFXItem } from '../../vfx-item';
import type { Composition } from '../../composition';
import type { Mesh } from '../../render';
import type { Texture } from '../../texture';
import type { SpriteItem, SpriteItemRenderInfo } from './sprite-item';
import { maxSpriteMeshItemCount, maxSpriteTextureCount, SpriteMesh } from './sprite-mesh';
import type { Engine } from '../../engine';

interface MeshSplit {
  indexStart: number, // items的lisIndex(绘制顺序)最小值
  renderInfo: SpriteItemRenderInfo,
  cacheId: string, // mesh对应的材质信息 items使用的一致
  items: VFXItem<SpriteItem>[], // 包含的SpriteItem
  dirty?: boolean,
  indexEnd?: number, // items的lisIndex最大值
  spriteMesh?: SpriteMesh, // 对应的mesh
  textures: Texture[], // 对应的纹理贴图
}

export interface LayerInfo {
  layerToAdd?: SpriteMesh[],
}

const itemSortProperty = 'listIndex';

export class SpriteGroup implements Disposable {
  public meshSplits: MeshSplit[] = [];
  public readonly items: VFXItem<SpriteItem>[] = [];
  public readonly meshes: Mesh[] = []; // meshSplits对应的mesh数组 每次diff后更新
  public time = 0;

  private readonly itemsToRemove: VFXItem<SpriteItem>[] = [];
  private readonly itemsToAdd: VFXItem<SpriteItem>[] = [];
  private engine: Engine;

  constructor (public composition: Composition) {
    this.engine = composition.getEngine();
  }

  /**
   * 合成reset的时候执行 清空items相关数组
   */
  resetMeshSplits () {
    this.meshSplits.length = 0;
    this.meshes.length = 0;
    this.items.length = 0;
    this.itemsToAdd.length = 0;
    this.itemsToRemove.length = 0;
  }

  /**
   * 根据需要添加/移除的元素计算需要增加/移除/修改顺序的mesh并返回
   */
  diffMeshSplits (): { remove?: Mesh[], add?: Mesh[], modify?: Mesh[], layer?: LayerInfo } | void {
    const splits = this.meshSplits;

    const itemsToRemove = this.itemsToRemove;
    const itemsToAdd = this.itemsToAdd;
    const splitsToRemove: MeshSplit[] = [];
    const meshToAdd: Mesh[] = [];
    const meshToRemove: Mesh[] = [];
    const meshToModify: Mesh[] = [];
    const items = this.items;
    const layer: LayerInfo = { layerToAdd: [] };
    let combined = [];

    /**
     * 移除元素
     * 图层元素，从items和含有元素的meshSplit中移除元素并获取需要移除的MeshSplit
     * 滤镜元素，从items移除元素，判断前一个元素 / 后一个元素所在meshSplit能否合并
     */
    for (let i = 0; i < itemsToRemove.length; i++) {
      const item = itemsToRemove[i];

      if (isSprite(item)) {
        splitsToRemove.push(...this.removeMeshSplitsItem(items, item, splits, itemsToRemove));
        this.check();
      } else {
        const itemIndex = items.indexOf(item);

        if (itemIndex > -1) {
          items.splice(itemIndex, 1);
          combined.length = 0;
          if (itemIndex > 0) {
            combined = this.combineSplits(items, itemIndex - 1, splits);
            splitsToRemove.push(...combined);
          }
          if (!combined.length && itemIndex <= items.length - 1) {
            combined = this.combineSplits(items, itemIndex, splits);
            splitsToRemove.push(...combined);
          }

          this.check();
        }
      }
    }
    let checkCombine = false;

    /**
     * 添加元素
     * 获取item增加后需要新增的meshSplit，根据renderInfo创建spriteMesh并增加到meshToAdd数组
     * 新增meshSplit都添加后(checkCombine) 检查meshSplit数组是否有相邻可以合并的meshSplit
     */
    for (let i = 0; i < itemsToAdd.length; i++) {
      const item = itemsToAdd[i];
      const neoSplits = this.addMeshSplitsItem(items, item, splits);

      for (let j = 0; j < neoSplits.length; j++) {
        const neoSplit: MeshSplit = neoSplits[j];

        if (neoSplit.spriteMesh) {
          throw new Error('no sprite mesh in neo split');
        }
        const sp = neoSplit.spriteMesh = new SpriteMesh(this.engine, neoSplit.renderInfo, this.composition);

        meshToAdd.push(sp.mesh);
        sp.setItems(neoSplit.items.map(c => c.content));
        sp.applyChange();
        if (sp.splitLayer) {
          layer.layerToAdd?.push(sp);
        }
        neoSplit.dirty = false;
        this.check();
        checkCombine = true;
      }
    }

    if (checkCombine) {
      for (let i = 0; i < splits.length - 1; i++) {
        const currentSplit = splits[i];
        const nextSplit = splits[i + 1];

        if (
          nextSplit.cacheId === currentSplit.cacheId &&
          !nextSplit.spriteMesh?.splitLayer &&
          !currentSplit.spriteMesh?.splitLayer &&
          currentSplit.items.length + nextSplit.items.length <= maxSpriteMeshItemCount
        ) {
          const first = currentSplit.items[0];
          const last = nextSplit.items[nextSplit.items.length - 1];
          const neo = this.getMeshSplits(items, items.indexOf(first), items.indexOf(last));

          if (neo.length === 1) {
            Object.keys(neo[0]).forEach(key => {
              // @ts-expect-error
              currentSplit[key] = neo[0][key as keyof MeshSplit];
            });
            currentSplit.spriteMesh?.setItems(currentSplit.items.map(i => i.content));
            currentSplit.spriteMesh?.applyChange();

            const mesh = nextSplit.spriteMesh?.mesh;

            if (currentSplit.spriteMesh && currentSplit.spriteMesh.mesh) {
              currentSplit.spriteMesh.mesh.priority = nextSplit.indexEnd!;
            }

            // @ts-expect-error
            if (meshToAdd.includes(mesh)) {
              removeItem(meshToAdd, mesh);
            } else {
              addItem(meshToRemove, mesh);
            }
            splits.splice(i + 1, 1);
            i--;//recheck
          }
        }
      }
    }
    // FIXME 重复赋值?
    itemsToRemove.length = 0;
    /**
     * 根据每个meshSplit的indexStart和mesh的priority判断mesh是否需要修改
     * 需要则添加到meshToModify数组
     */
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      // @ts-expect-error
      const spriteMesh: SpriteMesh = split.spriteMesh;

      if (split.items.length === 0) {
        throw new Error('split not combined');
      }
      if (split.dirty) {
        const priority = split.indexStart;

        if (spriteMesh.mesh.priority !== priority) {
          spriteMesh.mesh.priority = priority;
          meshToModify.push(spriteMesh.mesh);
        }
        spriteMesh.setItems(split.items.map(item => item.content));
      }
      spriteMesh.applyChange();
      split.dirty = false;
    }
    /**
     * 有需要移除的meshSplit 则废弃对应的mesh 保留material
     * 添加到meshToRemove数组
     */
    if (splitsToRemove.length) {
      for (let i = 0; i < splitsToRemove.length; i++) {
        const split = splitsToRemove[i];
        const sp = split.spriteMesh;
        // @ts-expect-error
        const mesh = sp.mesh;

        mesh.dispose({ material: { textures: DestroyOptions.keep } });
        meshToRemove.push(mesh);
      }
    }

    this.itemsToRemove.length = 0;
    this.itemsToAdd.length = 0;
    /**
     * 有mesh需要改动 返回
     */
    if (meshToAdd.length + meshToRemove.length + meshToModify.length) {
      const ms = this.meshes;

      // @ts-expect-error
      this.meshSplits.forEach((split, i) => ms[i] = split.spriteMesh.mesh);
      ms.length = this.meshSplits.length;

      return {
        add: meshToAdd.length ? meshToAdd : undefined,
        remove: meshToRemove.length ? meshToRemove : undefined,
        modify: meshToModify.length ? meshToModify : undefined,
        // @ts-expect-error
        layer: layer.layerToAdd.length > 0 ? layer : undefined,
      };
    }
  }

  /**
   * 合成生命周期开始时执行
   * 如果 items 中有该 sprite/filter 类型的 vfxItem 则添加到 itemsToRemove 数组中
   * 如果没有该 vfxItem 添加到 itemsToAdd 数组
   * @param vfxItem
   */
  addItem (vfxItem: VFXItem<SpriteItem>) {
    if (!this.items.includes(vfxItem)) {
      addItem(this.itemsToAdd, vfxItem);
    } else {
      removeItem(this.itemsToRemove, vfxItem);
    }
  }

  /**
   * 合成dispose时执行
   * 如果items中有该vfxItem 则添加到itemsToRemove数组中(sprite在头 filter在尾)
   * 如果没有该vfxItem 添加到 itemsToAdd数组
   */
  removeItem (item: VFXItem<SpriteItem>) {
    if (this.items.includes(item)) {
      if (isSprite(item)) {
        this.itemsToRemove.unshift(item);
      } else {
        this.itemsToRemove.push(item);
      }
    } else {
      removeItem(this.itemsToAdd, item);
    }
  }

  /**
   * 找到指定 item 所在的 spriteMesh
   * @param item
   * @returns
   */
  getSpriteMesh (item: SpriteItem): SpriteMesh | undefined {
    const splits = this.meshSplits;

    for (let i = 0; i < splits.length; i++) {
      // FIXME: spriteMesh 的可选性
      const mesh = splits[i].spriteMesh!;
      const itemIndex = mesh.items.indexOf(item);

      if (itemIndex > -1) {
        return mesh;
      }
    }
  }

  /**
   * 合成在每帧 tick 时元素更新后执行
   * 更新 mesh 的 geometry 和 material 中 item 对应位置上的数据
   */
  onUpdate (dt: number) {
    const splits = this.meshSplits;

    for (let i = 0; i < splits.length; i++) {
      // FIXME: spriteMesh 的可选性
      const mesh = splits[i].spriteMesh!;
      //mesh.time = time;
      const items = mesh.items;

      for (let j = 0; j < items.length; j++) {
        const item: SpriteItem = items[j];

        if (!item.ended) {
          mesh.updateItem(item);
        }
      }
      mesh.applyChange();
    }
  }

  dispose (): void {
    this.meshSplits.forEach(mesh => {
      mesh.spriteMesh?.mesh.dispose();
    });
  }

  private check () {
    if (__DEBUG__) {
      const splits = this.meshSplits;
      const index: (number | undefined)[] = [];

      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];

        if (index.includes(split.indexStart) || index.includes(split.indexEnd)) {
          // eslint-disable-next-line no-debugger
          debugger;
        }
        index.push(split.indexEnd, split.indexStart);
      }
    }
  }

  /**
   * 添加元素到合适的 meshSplit 上
   * 返回新添加的 meshSplit 数组（返回 meshSplit 没有真的创建 spriteMesh）
   * @internal
   */
  private addMeshSplitsItem (
    items: VFXItem<SpriteItem>[],
    item: VFXItem<SpriteItem>,
    splits: MeshSplit[],
  ): MeshSplit[] {
    const itemIndex = items.indexOf(item);

    if (itemIndex !== -1) {
      throw Error('item has been added');
    }
    const firstSplit = splits[0];

    if (!firstSplit) {
      addItemWithOrder(items, item, itemSortProperty);
      if (isSprite(item)) {
        const content = item.createContent();
        const split = {
          indexStart: item.listIndex,
          indexEnd: item.listIndex,
          items: [item],
          renderInfo: content.renderInfo,
          cacheId: content.renderInfo.cacheId,
          textures: [item.content.renderer.texture],
        };

        splits.unshift(split);

        return [split];
      }

      return [];
    }
    /**
     * 插入 item 到合适的 meshSplit 上
     * 对图层元素：
     *   1. 存在 item.listIndex < split.indexEnd 的 meshSplit，判断加入 item 后是否需要添加 meshSplit，把新增的 meshSplit（1或2个）插入到到 meshSplits 中, 并更新原来 meshSplit 上的数据
     *   2. 添加 item 到 items 数组
     *   3. 再执行一次 item 添加到最后一张 meshSplit 的合并算法，判断是否新增 meshSplit 并更新对应数据
     * 对滤镜元素：
     *   1. 存在 item.listIndex === split.indexEnd 的 meshSplit，执行 item 添加到 items 数组
     *   2. 否则若存在 item.listIndex < split.indexEnd 的 meshSplit，判断加入 item 后是否需要添加 meshSplit，把新增的 meshSplit（1个）插入到到 meshSplits 中, 并更新原来 meshSplit 上的数据
     *
     */
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const listIndex = item.listIndex;

      if (isSprite(item)) {
        // @ts-expect-error
        if (listIndex <= split.indexEnd) {
          addItemWithOrder(items, item, itemSortProperty);
          const itemIndex = items.indexOf(item);
          const indexStart = Math.min(itemIndex, items.indexOf(split.items[0]));
          const indexEnd = Math.max(itemIndex, items.indexOf(split.items[split.items.length - 1]));
          const neoSplits = this.getMeshSplits(items, indexStart, indexEnd);
          const neoSplitIndex = neoSplits.findIndex(split => split.items.includes(item));

          if (neoSplits.length === 2) {
            splits.splice(i + neoSplitIndex, 0, neoSplits[neoSplitIndex]);
            //1 or 0
            Object.keys(neoSplits[1 - neoSplitIndex]).forEach(key => {
              // @ts-expect-error
              split[key] = neoSplits[1 - neoSplitIndex][key as keyof MeshSplit];
            });

            return [neoSplits[neoSplitIndex]];
          } else if (neoSplits.length === 3) {
            Object.keys(neoSplits[0]).forEach(key => {
              // @ts-expect-error
              split[key] = neoSplits[0][key as keyof MeshSplit];
            });
            splits.splice(i + 1, 0, neoSplits[1], neoSplits[2]);
            if (neoSplitIndex !== 1) {
              throw Error('neo split not in middle');
            }

            return [neoSplits[1], neoSplits[2]];
          } else if (neoSplits.length !== 1) {
            throw Error('invalid splits 1');
          }
          //todo add case
          Object.keys(neoSplits[0]).forEach(key => {
            // @ts-expect-error
            split[key] = neoSplits[0][key as keyof MeshSplit];
          });

          return [];
        }
      } else {
        if (listIndex < split.indexStart || listIndex === split.indexEnd) {
          addItemWithOrder(items, item, itemSortProperty);

          return [];
          // @ts-expect-error
        } else if (listIndex < split.indexEnd) {
          addItemWithOrder(items, item, itemSortProperty);
          const lastItem = split.items[split.items.length - 1];
          const endIndex = items.indexOf(lastItem);
          const neoSplits = this.getMeshSplits(items, items.indexOf(split.items[0]), endIndex);

          Object.keys(neoSplits[0]).forEach(key => {
            // @ts-expect-error
            split[key] = neoSplits[0][key as keyof MeshSplit];
          });
          if (neoSplits.length === 2) {
            splits.splice(i + 1, 0, neoSplits[1]);

            return [neoSplits[1]];
          } else if (neoSplits.length !== 1) {
            throw Error('invalid splits 2');
          }
        }
      }
    }

    addItemWithOrder(items, item, itemSortProperty);

    if (isSprite(item)) {
      const last = splits[splits.length - 1];
      const neoSplits = this.getMeshSplits(items, items.indexOf(last.items[0]), items.indexOf(item));

      Object.keys(neoSplits[0]).forEach(key => {
        // @ts-expect-error
        last[key] = neoSplits[0][key as keyof MeshSplit];
      });
      if (neoSplits.length === 2) {
        splits.push(neoSplits[1]);

        return [neoSplits[1]];
      } else if (neoSplits.length !== 1) {
        throw Error('invalid splits 3');
      }
    }

    return [];
  }

  /**
   * 从包含指定item的meshSplit、this.items中移除指定item
   * 并判断指定meshSplit能否与this.meshSplits中的其它meshSplit合并
   * 返回不需要的meshSplit(没有items/内容合并到其它meshSplit)
   */
  private removeMeshSplitsItem (items: VFXItem<SpriteItem>[], item: VFXItem<SpriteItem>, splits: MeshSplit[], itemsToRemove?: VFXItem<SpriteItem>[]): MeshSplit[] {
    let targetSplit: MeshSplit | null = null;
    let targetSplitIndex = -1;
    const ret: MeshSplit[] = [];

    /**
     * 遍历this.meshSplits，找到元素的listIndex在split的indexStart和indexEnd范围内的第一个meshSplit
     */
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];

      // @ts-expect-error
      if (split.indexStart <= item.listIndex && split.indexEnd >= item.listIndex) {
        targetSplit = split;
        targetSplitIndex = i;

        break;
      }
    }

    if (targetSplit) {
      const index = targetSplit.items.indexOf(item);

      if (index < 0) {
        if (itemsToRemove?.includes(item)) {
          //ignore removed
          return [];
        }
        throw Error('item not found');
      }
      targetSplit.items.splice(index, 1);
      targetSplit.dirty = true;
      removeItem(items, item);

      /**
       * 如果找到的meshSplit中items为空 说明不需要这个meshSplit了
       * 把它从this.meshSplits中移除，并添加到返回的结果数组ret中
       * 如果meshSplit中还包含item，就把indexStart和indexEnd做对应修改
       */
      if (targetSplit.items.length === 0) {
        removeItem(splits, targetSplit);
        ret.push(targetSplit);
        targetSplitIndex = targetSplitIndex - 1;
        targetSplit = splits[targetSplitIndex];
        // this.meshSplits为空 不需要执行合并算法 直接返回
        if (!splits.length || targetSplitIndex < 0) {
          return ret;
        }
      } else {
        targetSplit.indexEnd = targetSplit.items[targetSplit.items.length - 1].listIndex;
        targetSplit.indexStart = targetSplit.items[0].listIndex;
      }

      /**
       * 根据targetSplit(含有目标元素的meshSplit/ 它的前一个)在meshSplits数组中的位置，执行合并算法：
       * 如果是第一个或倒数第二个，与它后面一个判断能否执行合并
       * 如果最后一个，则判断能否和前一个合并
       * 不是上述位置,则和前后的meshSplit都需要判断能否合并
       * 如果两个meshSplit允许共用mesh 则合并
       */
      if (targetSplitIndex === 0 || targetSplitIndex === splits.length - 2) {
        // this.meshSplits中的最前两个或者最后两个meshSplit
        const p0 = splits[targetSplitIndex];
        const p1 = splits[targetSplitIndex + 1];

        if (p0 && p1) {
          const i0 = p0.items[0];
          const i1 = p1.items[p1.items.length - 1];
          const meshes = this.getMeshSplits(items, items.indexOf(i0), items.indexOf(i1));

          // 两个meshSplit可以合并成一个 把后者并入前一个meshSplit 共用前者的spriteMesh
          if (meshes.length === 1) {
            meshes[0].spriteMesh = splits[targetSplitIndex].spriteMesh;
            meshes[0].spriteMesh?.invalidMaterial();
            splits[targetSplitIndex] = meshes[0];
            ret.push(splits.splice(targetSplitIndex + 1, 1)[0]);
          }
        }
      } else if (targetSplitIndex === splits.length - 1) {
        // 和前一个判断能否合并
        if (targetSplit.items.length === 0) {
          ret.push(splits.splice(targetSplitIndex, 1)[0]);
        } else {
          const p0 = splits[targetSplitIndex - 1];
          const p1 = splits[targetSplitIndex];
          const i0 = p0.items[0];
          const i1 = p1.items[p1.items.length - 1];
          const meshes = this.getMeshSplits(items, items.indexOf(i0), items.indexOf(i1));

          if (meshes.length === 1) {
            meshes[0].spriteMesh = splits[targetSplitIndex - 1].spriteMesh;
            meshes[0].spriteMesh?.invalidMaterial();
            splits[targetSplitIndex - 1] = meshes[0];
            ret.push(splits.splice(targetSplitIndex, 1)[0]);
          }
        }
      } else {
        // 和前后都需要判断能否合并
        const p0 = splits[targetSplitIndex - 1];
        const p1 = splits[targetSplitIndex + 1];
        const i0 = p0.items[0];
        const i1 = p1.items[p1.items.length - 1];
        const meshes = this.getMeshSplits(items, items.indexOf(i0), items.indexOf(i1));

        if (meshes.length === 2) {
          meshes[0].spriteMesh = splits[targetSplitIndex].spriteMesh;
          meshes[1].spriteMesh = splits[targetSplitIndex + 1].spriteMesh;
          splits[targetSplitIndex] = meshes[0];
          splits[targetSplitIndex + 1] = meshes[1];
          ret.push(splits.splice(targetSplitIndex - 1, 1)[0]);
        }
      }
    }

    return ret;
  }

  /**
   * 合并Mesh
   * 找到item所在的meshSplit 判断能否和前一张/后一张合并
   * 返回不需要的meshSplit(内容合并到其它meshSplit)
   */
  private combineSplits (items: VFXItem<SpriteItem>[], itemIndex: number, splits: MeshSplit[]): MeshSplit[] {
    const item = items[itemIndex];
    const ret = [];

    // item.composition 不存在表示元素已经dispose
    if (isSprite(item) && item.composition) {
      // FIXME: 可选性
      let targetSplitIndex!: number;

      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];

        if (split.items.includes(item)) {
          targetSplitIndex = i;

          break;
        }
      }
      let p0: MeshSplit;
      let p1: MeshSplit;

      if (targetSplitIndex === 0) {
        p0 = splits[targetSplitIndex];
        p1 = splits[targetSplitIndex + 1];
      } else {
        p0 = splits[targetSplitIndex - 1];
        p1 = splits[targetSplitIndex];
      }
      if (p0 && p1) {
        const startIndex = items.indexOf(p0.items[0]);
        const endIndex = items.indexOf(p1.items[p1.items.length - 1]);

        if (Number.isInteger(startIndex) && Number.isInteger(endIndex)) {
          const meshes = this.getMeshSplits(items, startIndex, endIndex);

          if (meshes.length === 1) {
            meshes[0].spriteMesh = splits[targetSplitIndex].spriteMesh;
            if (targetSplitIndex === 0) {
              splits[0] = meshes[0];
              ret.push(splits.splice(1, 1)[0]);
            } else {
              ret.push(splits.splice(targetSplitIndex - 1, 1)[0]);
              splits[targetSplitIndex - 1] = meshes[0];
            }
          }
        }
      }
    }

    return ret;
  }

  /**
   *  判断items中[startIndex, endIndex]范围的元素需要多少个meshSplit
   *  item的filter、材质的显示面、蒙板、混合模式、顺序、深度遮挡等信息一致且在mesh容纳的范围内
   *  则放置到同一个meshSplit上，上述信息记录在cacheId中
   */
  private getMeshSplits (items: VFXItem<SpriteItem>[], startIndex = 0, endIndex = items.length - 1, init?: boolean): MeshSplit[] {
    let current: MeshSplit | null = null;
    const ret: MeshSplit[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];

      // 不可见的元素跳过 不参与合并
      if (!init && (!item.started || item.lifetime < 0)) {
        continue;
      }
      if (!isSprite(item)) {
        if (init && (!item.contentVisible)) {
          continue;
        }
        if (current) {
          ret.push(current);
          current = null;
        }
      } else {
        const cacheId = item.createContent().renderInfo.cacheId;
        const texture = item.content.renderer.texture;
        let replaceCurrent = true;

        if (current) {
          const texInc = current.textures.includes(texture) ? 0 : 1;

          if (
            current.cacheId === cacheId &&
            VFXItem.isSprite(item) &&
            current.items.length < maxSpriteMeshItemCount &&
            (texInc + current.textures.length) <= maxSpriteTextureCount
          ) {
            addItemWithOrder(current.items, item, itemSortProperty);
            addItem(current.textures, texture);
            replaceCurrent = false;
          } else {
            ret.push(current);
          }
        }
        if (replaceCurrent) {
          current = {
            indexStart: item.listIndex,
            cacheId,
            renderInfo: item.content.renderInfo,
            items: [item],
            textures: [texture],
          };
        }
      }
    }
    if (current) {
      ret.push(current);
    }
    ret.forEach(split => {
      split.indexEnd = split.items[split.items.length - 1].listIndex;
      split.dirty = true;
    });

    return ret;
  }
}

function isSprite (item: VFXItem<VFXItemContent>) {
  return VFXItem.isSprite(item) || VFXItem.isFilterSprite(item);
}
