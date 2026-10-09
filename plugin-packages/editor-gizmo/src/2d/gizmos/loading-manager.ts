import { EventEmitter } from '@galacean/effects';
import { type Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../math';

/** 单个元素的加载提示配置。 */
export type LoadingItemOptions = {
  /** 加载提示文本。 */
  text?: string,
  /** 相对目标元素实时包围盒左上角的视图像素偏移；未设置时文案在 loading 区域内居中。 */
  position?: Vector2,
  /** 打开 loading 时是否移除目标元素的选中状态。 */
  clearSelected?: boolean,
  /** 自定义加载区域。 */
  loadingBox?: Box2,
};

/** 单个元素的当前加载状态。 */
export interface LoadingItemState {
  /** 加载提示配置。 */
  tip: LoadingItemOptions,
  /** 自定义加载区域。 */
  loadingBox?: Box2,
}

/** 加载状态集合的一次变更。 */
export type LoadingManagerChange = {
  /** 变更后的全部加载元素 ID。 */
  ids: string[],
  /** 新增加载元素 ID。 */
  addedIds: string[],
  /** 已删除加载元素 ID。 */
  removedIds: string[],
  /** 已更新加载元素 ID。 */
  updatedIds: string[],
};

/** 加载状态管理器事件参数。 */
type LoadingManagerEvents = {
  /** 加载集合变更事件。 */
  change: [LoadingManagerChange],
  /** 请求移除选中元素事件。 */
  removeselecteditems: [string[]],
};

/** 管理元素加载状态并向 LoadingGizmo 提供稳定数据。 */
export class LoadingManager extends EventEmitter<LoadingManagerEvents> {
  private readonly items = new Map<string, LoadingItemState>();

  /** 当前加载元素 ID。 */
  get ids (): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * 获取元素加载状态。
   * @param id 元素 ID
   * @returns 加载状态；不存在时返回 undefined
   */
  get (id: string): LoadingItemState | undefined {
    return this.items.get(id);
  }

  /**
   * 添加元素加载状态。
   * @param id 元素 ID
   * @param options 加载提示配置
   */
  add (id: string, options?: LoadingItemOptions): void {
    if (this.items.has(id)) {
      return;
    }
    this.items.set(id, {
      tip: {
        text: options?.text ?? '',
        position: options?.position ? new Vector2(options.position.x, options.position.y) : undefined,
      },
      loadingBox: options?.loadingBox?.clone(),
    });
    this.emitChange({ addedIds: [id], removedIds: [], updatedIds: [] });
    if (options?.clearSelected) {
      this.emit('removeselecteditems', [id]);
    }
  }

  /**
   * 删除元素加载状态。
   * @param id 元素 ID
   */
  delete (id: string): void {
    if (!this.items.delete(id)) {
      return;
    }
    this.emitChange({ addedIds: [], removedIds: [id], updatedIds: [] });
  }

  /**
   * 更新元素加载提示。
   * @param id 元素 ID
   * @param options 增量加载提示配置
   */
  update (id: string, options: LoadingItemOptions): void {
    const item = this.items.get(id);

    if (!item) {
      console.warn(`Loading item ${id} not found.`);

      return;
    }
    if (options.text !== undefined) {
      item.tip.text = options.text;
    }
    if (options.position !== undefined) {
      item.tip.position = new Vector2(options.position.x, options.position.y);
    }
    this.emitChange({ addedIds: [], removedIds: [], updatedIds: [id] });
  }

  /**
   * 发出包含完整 ID 列表的加载状态变更。
   * @param change 增量变更
   */
  private emitChange (change: Omit<LoadingManagerChange, 'ids'>): void {
    this.emit('change', { ids: this.ids, ...change });
  }
}
