import type { Engine } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { type Vector2 } from '../math';
import { FrameLayoutMode, type AutoLayoutConfig, type FrameInfo, type LayoutInfo } from './types';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { getItemViewBox } from '../items/item-geometry';
import { getPlayerItemById } from '../items/item-hierarchy';
import { isFramePlayerItem } from '../items/item-predicates';
import { computeFrameAutoLayout, type FrameAutoLayoutOptions, type FrameAutoLayoutResult, type FrameLayoutItem } from './frame-auto-layout';

/** 画板运行时布局数据。 */
export type FrameRecord = {
  /** 画板元素实例 ID。 */
  id: string,
  /** 布局模式。 */
  layoutMode: FrameLayoutMode,
  /** 子元素实例 ID。 */
  children: string[],
  /** 自动布局约束。 */
  autoLayoutConfig?: AutoLayoutConfig,
  /** 子元素布局信息。 */
  layoutInfos: Record<string, LayoutInfo>,
};

/** 新建或更新画板数据的输入。 */
export type FrameRecordInput = {
  /** 画板元素实例 ID。 */
  id: string,
  /** 布局模式。 */
  layoutMode?: FrameLayoutMode,
  /** 子元素实例 ID。 */
  children?: readonly string[],
  /** 自动布局约束。 */
  autoLayoutConfig?: AutoLayoutConfig,
  /** 子元素布局信息。 */
  layoutInfos?: Readonly<Record<string, LayoutInfo>>,
};

/**
 * 复制单个布局信息。
 * @param info 原布局信息
 * @returns 布局信息副本
 */
function cloneLayoutInfo (info: LayoutInfo): LayoutInfo {
  return {
    row: info.row,
    column: info.column,
    position: info.position ? [...info.position] : undefined,
  };
}

/**
 * 复制子元素布局信息表。
 * @param infos 原布局信息表
 * @returns 布局信息表副本
 */
function cloneLayoutInfos (infos: Readonly<Record<string, LayoutInfo>> | undefined): Record<string, LayoutInfo> {
  const result: Record<string, LayoutInfo> = {};
  const source = infos ?? {};

  for (const id of Object.keys(source)) {
    result[id] = cloneLayoutInfo(source[id]);
  }

  return result;
}

/**
 * 将画板输入归一化为完整运行时数据。
 * @param record 画板输入
 * @returns 完整画板数据副本
 */
function cloneRecord (record: FrameRecordInput): FrameRecord {
  return {
    id: record.id,
    layoutMode: record.layoutMode ?? FrameLayoutMode.FREE,
    children: [...record.children ?? []],
    autoLayoutConfig: record.autoLayoutConfig ? { ...record.autoLayoutConfig } : undefined,
    layoutInfos: cloneLayoutInfos(record.layoutInfos),
  };
}

/** 管理画板布局数据及其视图投影。 */
export class FrameManager {
  private readonly records = new Map<string, FrameRecord>();
  private readonly boxes = new Map<string, Box2>();
  private readonly engine: Engine;

  /**
   * @param engine 用于更新画板投影的 Effects 引擎
   */
  constructor (engine: Engine) {
    this.engine = engine;
  }

  /**
   * 新建或覆盖画板数据。
   * @param input 画板数据
   * @returns 保存后的画板记录
   */
  upsertFrame (input: FrameRecordInput): FrameRecord {
    const record = cloneRecord(input);

    this.records.set(record.id, record);

    return record;
  }

  /**
   * 获取画板记录，不存在时创建。
   * @param input 画板数据
   * @returns 已存在或新建的画板记录
   */
  ensureFrame (input: FrameRecordInput): FrameRecord {
    return this.records.get(input.id) ?? this.upsertFrame(input);
  }

  /**
   * 删除画板记录和投影。
   * @param id 画板 ID
   * @returns 是否删除了画板记录
   */
  deleteFrame (id: string): boolean {
    this.boxes.delete(id);

    return this.records.delete(id);
  }

  /** 清空全部画板数据和投影。 */
  clear (): void {
    this.records.clear();
    this.boxes.clear();
  }

  /**
   * 使用输入列表重建画板数据。
   * @param records 画板数据列表
   */
  hydrate (records: readonly FrameRecordInput[]): void {
    this.clear();
    for (const record of records) {
      this.upsertFrame(record);
    }
  }

  /** @returns 全部画板数据的深拷贝快照。 */
  snapshot (): FrameRecord[] {
    return Array.from(this.records.values(), cloneRecord);
  }

  /**
   * 获取指定画板数据。
   * @param id 画板 ID
   * @returns 画板数据；不存在时返回 undefined
   */
  getFrame (id: string): Readonly<FrameRecord> | undefined {
    return this.records.get(id);
  }

  /** @returns 全部画板数据。 */
  getFrames (): readonly Readonly<FrameRecord>[] {
    return Array.from(this.records.values());
  }

  /**
   * 设置画板布局模式。
   * @param id 画板 ID
   * @param layoutMode 布局模式
   */
  setLayoutMode (id: string, layoutMode: FrameLayoutMode): void {
    const record = this.records.get(id);

    if (record) {
      record.layoutMode = layoutMode;
    }
  }

  /**
   * 替换画板子元素列表。
   * @param id 画板 ID
   * @param children 子元素 ID
   */
  setChildren (id: string, children: readonly string[]): void {
    const record = this.records.get(id);

    if (record) {
      record.children = [...children];
    }
  }

  /**
   * 向画板添加子元素。
   * @param id 画板 ID
   * @param childId 子元素 ID
   * @returns 是否添加成功
   */
  addChild (id: string, childId: string): boolean {
    const record = this.records.get(id);

    if (!record || record.children.includes(childId)) {
      return false;
    }
    record.children.push(childId);

    return true;
  }

  /**
   * 从画板移除子元素及其布局信息。
   * @param id 画板 ID
   * @param childId 子元素 ID
   * @returns 是否移除成功
   */
  removeChild (id: string, childId: string): boolean {
    const record = this.records.get(id);

    if (!record) {
      return false;
    }
    const index = record.children.indexOf(childId);

    if (index < 0) {
      return false;
    }
    record.children.splice(index, 1);
    const layoutInfos = { ...record.layoutInfos };

    delete layoutInfos[childId];
    record.layoutInfos = layoutInfos;

    return true;
  }

  /**
   * 替换画板的全部子元素布局信息。
   * @param id 画板 ID
   * @param layoutInfos 子元素布局信息
   */
  setLayoutInfos (id: string, layoutInfos: Readonly<Record<string, LayoutInfo>> | undefined): void {
    const record = this.records.get(id);

    if (record) {
      record.layoutInfos = cloneLayoutInfos(layoutInfos);
    }
  }

  /**
   * 设置单个子元素的布局信息。
   * @param id 画板 ID
   * @param childId 子元素 ID
   * @param layoutInfo 布局信息
   */
  setChildLayoutInfo (id: string, childId: string, layoutInfo: LayoutInfo): void {
    const record = this.records.get(id);

    if (record) {
      record.layoutInfos[childId] = cloneLayoutInfo(layoutInfo);
    }
  }

  /**
   * 设置画板自动布局约束。
   * @param id 画板 ID
   * @param config 自动布局约束
   */
  setAutoLayoutConfig (id: string, config: AutoLayoutConfig | undefined): void {
    const record = this.records.get(id);

    if (record) {
      record.autoLayoutConfig = config ? { ...config } : undefined;
    }
  }

  /**
   * 使用画板当前布局信息计算自动布局。
   * @param frameId 画板 ID
   * @param items 待布局元素
   * @param options 内边距和元素间距
   * @returns 自动布局结果；画板不存在时返回 undefined
   */
  computeAutoLayout (
    frameId: string,
    items: readonly Pick<FrameLayoutItem, 'id' | 'box'>[],
    options: Omit<FrameAutoLayoutOptions, 'config'> = {},
  ): FrameAutoLayoutResult | undefined {
    const record = this.records.get(frameId);

    if (!record) {
      return undefined;
    }

    return computeFrameAutoLayout(items.map(item => ({
      ...item,
      row: record.layoutInfos[item.id]?.row,
      column: record.layoutInfos[item.id]?.column,
    })), {
      ...options,
      config: record.autoLayoutConfig,
    });
  }

  /**
   * 计算元素重排后的完整布局信息。
   * @param frameId 画板 ID
   * @param draggedItemId 被拖拽元素 ID
   * @param fromRow 原行号
   * @param fromColumn 原列号
   * @param toRow 目标行号
   * @param toColumn 目标列号
   * @returns 重排后的布局信息；元素不属于画板时返回 undefined
   */
  computeLayoutInfosAfterReorder (
    frameId: string,
    draggedItemId: string,
    fromRow: number,
    fromColumn: number,
    toRow: number,
    toColumn: number,
  ): Record<string, LayoutInfo> | undefined {
    // 1. 校验拖拽元素并复制当前布局信息。
    const record = this.records.get(frameId);

    if (!record?.children.includes(draggedItemId)) {
      return undefined;
    }

    const result = cloneLayoutInfos(record.layoutInfos);

    // 2. 根据同行或跨行移动调整受影响元素的列号。
    if (fromRow !== toRow || fromColumn !== toColumn) {
      if (fromRow === toRow) {
        for (const [id, info] of Object.entries(result)) {
          if (id === draggedItemId || info.row !== fromRow) {
            continue;
          }
          if (fromColumn < toColumn && info.column > fromColumn && info.column <= toColumn) {
            info.column--;
          } else if (fromColumn > toColumn && info.column >= toColumn && info.column < fromColumn) {
            info.column++;
          }
        }
      } else {
        for (const [id, info] of Object.entries(result)) {
          if (id !== draggedItemId && info.row === fromRow && info.column > fromColumn) {
            info.column--;
          }
        }
        const targetItems = Object.entries(result)
          .filter(([id, info]) => id !== draggedItemId && info.row === toRow && info.column >= toColumn)
          .sort((a, b) => b[1].column - a[1].column);

        for (const [, info] of targetItems) {
          info.column++;
        }
      }
    }

    // 3. 写入拖拽元素的目标位置。
    result[draggedItemId] = {
      ...result[draggedItemId],
      row: toRow,
      column: toColumn,
    };

    return result;
  }

  /** 在每帧更新时同步画板投影。 */
  onUpdate (): void {
    this.updateViewBoxes();
  }

  /** 更新全部画板的视图包围盒。 */
  updateViewBoxes (): void {
    const engine = this.engine;
    const containerSize = GizmoViewportUtils.getContainerSize(engine.canvas.parentElement!);

    for (const record of this.records.values()) {
      const item = getPlayerItemById(engine.sceneServer.compositions[0], record.id);

      this.boxes.set(
        record.id,
        item && isFramePlayerItem(item)
          ? getItemViewBox(item, containerSize)
          : new Box2(),
      );
    }
    for (const id of Array.from(this.boxes.keys())) {
      if (!this.records.has(id)) {
        this.boxes.delete(id);
      }
    }
  }

  /** @returns 带当前视图包围盒的全部画板信息。 */
  getViewInfos (): FrameInfo[] {
    return Array.from(this.records.values(), record => this.toViewInfo(record));
  }

  /**
   * 获取指定画板的视图信息。
   * @param id 画板 ID
   * @returns 画板视图信息；不存在时返回 undefined
   */
  getViewInfo (id: string): FrameInfo | undefined {
    const record = this.records.get(id);

    return record ? this.toViewInfo(record) : undefined;
  }

  /**
   * 查找元素所属的画板。
   * @param itemId 元素 ID
   * @returns 父画板记录；不存在时返回 undefined
   */
  getParentFrame (itemId: string): Readonly<FrameRecord> | undefined {
    return Array.from(this.records.values()).find(record => record.children.includes(itemId));
  }

  /**
   * 查找包含指定视图坐标的画板。
   * @param point 视图坐标
   * @returns 命中的画板视图信息
   */
  findFrameAt (point: Vector2): FrameInfo | undefined {
    return this.getViewInfos().find(info => info.box.containsPoint(point));
  }

  /**
   * 将画板记录转换为视图信息。
   * @param record 画板记录
   * @returns 画板视图信息
   */
  private toViewInfo (record: FrameRecord): FrameInfo {
    return {
      id: record.id,
      box: this.boxes.get(record.id) ?? new Box2(),
      layoutMode: record.layoutMode,
      children: [...record.children],
      layoutInfos: cloneLayoutInfos(record.layoutInfos),
    };
  }
}
