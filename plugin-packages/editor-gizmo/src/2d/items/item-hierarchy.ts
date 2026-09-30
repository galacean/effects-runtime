import type { Composition, VFXItem } from '@galacean/effects';
import { isEffectsPlayerItem, isFramePlayerItem } from './item-predicates';

/**
 * 获取元素自身或祖先链中最近的特效容器。
 *
 * 默认编辑模式下，Effects 预合成的运行时子节点只负责渲染，点选、框选等交互
 * 会归并到该容器；EffectsEditMode 使用本方法识别当前放开的子树边界。
 * @param item 待解析的播放器元素
 * @returns 最近的特效容器；不在特效子树中时返回 undefined
 */
export function getEffectsPlayerItemOwner (item: VFXItem | undefined): VFXItem | undefined {
  let current = item;

  while (current) {
    if (isEffectsPlayerItem(current)) {
      return current;
    }
    current = current.parent;
  }

  return undefined;
}

/**
 * 获取元素祖先链中的所有画板。
 *
 * 不包含元素自身，结果按从近到远排列。
 * @param item 待检查的播放器元素
 * @returns 元素所在的画板祖先列表
 */
export function getFramePlayerItemAncestors (item: VFXItem): VFXItem[] {
  const frames: VFXItem[] = [];
  let parent = item.parent;

  while (parent) {
    if (isFramePlayerItem(parent)) {
      frames.push(parent);
    }
    parent = parent.parent;
  }

  return frames;
}

/**
 * 获取播放器元素的所有子元素。
 * @param item 播放器元素
 * @returns 子元素数组
 */
export function getItemChildren (item: VFXItem) {
  const children: VFXItem[] = [];

  const isFrameItem = isFramePlayerItem(item);
  const isEffectItem = isEffectsPlayerItem(item);

  if (isEffectItem) {
    return children;
  }
  /**
   * 递归展开子元素。
   * @param items 当前层子元素
   * @returns 当前层及其全部后代
   */
  function getAllChildren (items: VFXItem[]): VFXItem[] {
    const result: VFXItem[] = [];

    for (const child of items) {
      result.push(child);
      if (child.children && child.children.length > 0) {
        result.push(...getAllChildren(child.children));
      }
    }

    return result;
  }

  if (isFrameItem) {
    return getAllChildren(item.children);
  } else if (item.children && item.children.length > 0) {
    return getAllChildren(item.children);
  }

  return children;
}

/**
 * 在合成元素树内按实例 ID 查找元素。
 * @param composition 合成（无合成返回 undefined）
 * @param id 元素 instanceId
 * @returns 命中元素；未命中或无合成返回 undefined
 */
export function getPlayerItemById (composition: Composition | undefined, id: string): VFXItem | undefined {
  if (!composition) {
    return undefined;
  }
  /**
   * 在当前元素子树中递归查找实例。
   * @param items 当前层元素。
   * @param targetId 目标实例 ID。
   * @returns 命中的元素。
   */
  const dfs = (items: VFXItem[], targetId: string): VFXItem | undefined => {
    for (const item of items) {
      if (item.getInstanceId() === targetId) {
        return item;
      }
      const found = dfs(item.children, targetId);

      if (found) {
        return found;
      }
    }

    return undefined;
  };

  return dfs(composition.items, id);
}
