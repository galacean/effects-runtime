import { EventEmitter } from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import { type Box2 } from '@galacean/effects-math/es/extension/index';
import type { Vector2 } from '../math';

/** 文本与纹理提示共用的布局和加载配置。 */
type LoadingItemCommonOptions = {
  /** 相对目标元素实时包围盒左上角的视图像素偏移；未设置时提示在 loading 区域内居中。 */
  position?: Vector2,
  /** 打开 loading 时是否移除目标元素的选中状态。 */
  clearSelected?: boolean,
  /** 自定义加载区域，同时约束覆盖层与提示；纹理在区域内保持比例缩放。 */
  loadingBox?: Box2,
};

/** 加载提示的内容类型。 */
export enum LoadingTextTipType {
  TEXT = 'text',
  TEXTURE = 'texture',
}

/** 文本加载提示。 */
export type LoadingTextTipOptions = LoadingItemCommonOptions & {
  type: LoadingTextTipType.TEXT,
  text: string,
};

/** 纹理加载提示，纹理由调用方管理和释放。 */
export type LoadingTextureTipOptions = LoadingItemCommonOptions & {
  type: LoadingTextTipType.TEXTURE,
  texture: Texture,
};

/** 单个元素的加载提示配置，文本与纹理互斥。 */
export type LoadingItemOptions = LoadingTextTipOptions | LoadingTextureTipOptions;

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
  private readonly items = new Map<string, LoadingItemOptions>();

  /** 当前加载元素 ID。 */
  get ids (): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * 获取元素加载状态。
   * @param id 元素 ID
   * @returns 加载状态；不存在时返回 undefined
   */
  get (id: string): LoadingItemOptions | undefined {
    return this.items.get(id);
  }

  /**
   * 添加元素加载状态。
   * @param id 元素 ID
   * @param options 加载提示配置
   */
  add (id: string, options: LoadingItemOptions = { type: LoadingTextTipType.TEXT, text: '' }): void {
    if (this.items.has(id)) {
      return;
    }
    this.items.set(id, {
      ...options,
      position: options.position?.clone(),
      loadingBox: options.loadingBox?.clone(),
    });
    this.emitChange({ addedIds: [id], removedIds: [], updatedIds: [] });
    if (options.clearSelected) {
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
   * @param options 替换提示内容；未提供的布局沿用当前配置
   */
  update (id: string, options: LoadingItemOptions): void {
    const item = this.items.get(id);

    if (!item) {
      console.warn(`Loading item ${id} not found.`);

      return;
    }
    this.items.set(id, {
      ...options,
      position: options.position?.clone() ?? item.position,
      loadingBox: options.loadingBox?.clone() ?? item.loadingBox,
    });
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
