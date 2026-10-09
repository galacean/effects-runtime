import type { AutoLayoutConfig } from './types';
import type { Box2 } from '@galacean/effects-math/es/extension/index';

/** 参与画板自动布局的元素。 */
export type FrameLayoutItem = {
  /** 元素 ID。 */
  id: string,
  /** 元素包围盒。 */
  box: Box2,
  /** 已指定的行号。 */
  row?: number,
  /** 已指定的列号。 */
  column?: number,
};

/** 自动布局后的元素位置。 */
export type FrameLayoutResultItem = {
  /** 元素 ID。 */
  id: string,
  /** 相对画板左上角的中心位置。 */
  position: [number, number],
  /** 行号。 */
  row: number,
  /** 列号。 */
  column: number,
};

/** 画板自动布局选项。 */
export type FrameAutoLayoutOptions = {
  /** 画板内边距。 */
  padding?: number,
  /** 元素间距。 */
  gap?: number,
  /** 行宽和行数约束。 */
  config?: AutoLayoutConfig,
};

/** 画板自动布局结果。 */
export type FrameAutoLayoutResult = {
  /** 布局后的元素。 */
  items: FrameLayoutResultItem[],
  /** 布局所需的画板尺寸。 */
  size: [number, number],
};

/** 带内部坐标的布局结果。 */
type PositionedFrameLayoutItem = FrameLayoutResultItem & {
  /** 元素中心 X 坐标。 */
  x: number,
  /** 元素中心 Y 坐标。 */
  y: number,
};

/**
 * 按行号对元素分组。
 * @param items 待分组元素
 * @returns 行号到元素列表的映射
 */
function groupItemsByRow<T extends { row?: number }> (items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();

  for (const item of items) {
    const row = item.row ?? 0;
    const group = groups.get(row);

    if (group) {
      group.push(item);
    } else {
      groups.set(row, [item]);
    }
  }

  return groups;
}

/**
 * 按货架规则排列未指定列位置的元素。
 * @param items 待布局元素
 * @param padding 画板内边距
 * @param gap 元素间距
 * @param config 行宽和行数约束
 * @returns 带内部坐标的布局结果
 */
function calculateShelfLayout (
  items: FrameLayoutItem[],
  padding: number,
  gap: number,
  config?: AutoLayoutConfig,
): { items: PositionedFrameLayoutItem[], size: [number, number] } {
  // 1. 按行号组织元素并初始化布局边界。
  const placedItems: PositionedFrameLayoutItem[] = [];
  const rowGroups = groupItemsByRow(items);
  const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);
  let currentY = padding;
  let maxX = padding;

  // 2. 逐行排列元素，并在达到宽度约束时换行。
  for (const row of sortedRows) {
    const rowItems = rowGroups.get(row) ?? [];
    let currentX = padding;
    let currentShelfHeight = 0;
    let column = 0;
    let currentRowCount = 1;

    for (const item of rowItems) {
      const { x: width, y: height } = item.box.getSize();
      const wouldExceedMaxWidth = config?.maxRowWidth !== undefined
        && currentX + width + padding > config.maxRowWidth;
      let needNewShelf = wouldExceedMaxWidth && currentX > padding;

      if (needNewShelf && config?.maxRowCount !== undefined && currentRowCount >= config.maxRowCount) {
        needNewShelf = false;
      }
      if (needNewShelf) {
        currentY += currentShelfHeight + gap;
        currentX = padding;
        currentShelfHeight = height;
        column = 0;
        currentRowCount++;
      } else {
        currentShelfHeight = Math.max(currentShelfHeight, height);
      }
      placedItems.push({
        id: item.id,
        position: [currentX + width / 2, currentY + height / 2],
        x: currentX + width / 2,
        y: currentY + height / 2,
        row,
        column,
      });
      maxX = Math.max(maxX, currentX + width + padding);
      currentX += width + gap;
      column++;
    }
    if (rowItems.length > 0) {
      currentY += currentShelfHeight + gap;
    }
  }

  // 3. 根据已占用范围计算画板尺寸。
  return {
    items: placedItems,
    size: [Math.max(maxX, padding * 2), Math.max(currentY - gap + padding, padding * 2)],
  };
}

/**
 * 保留已指定列，并为其余元素分配空闲列。
 * @param items 待布局元素
 * @param padding 画板内边距
 * @param gap 元素间距
 * @returns 带内部坐标的布局结果
 */
function calculateMixedLayout (
  items: FrameLayoutItem[],
  padding: number,
  gap: number,
): { items: PositionedFrameLayoutItem[], size: [number, number] } {
  // 1. 按行号组织元素并初始化布局边界。
  const placedItems: PositionedFrameLayoutItem[] = [];
  const rowGroups = groupItemsByRow(items);
  const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);
  let currentY = padding;
  let maxX = padding;

  // 2. 逐行保留显式列号，并将无列号元素填入空位。
  for (const row of sortedRows) {
    const rowItems = rowGroups.get(row) ?? [];
    const withColumn = rowItems.filter(item => item.column !== undefined);
    const withoutColumn = rowItems.filter(item => item.column === undefined);
    const rowHeight = Math.max(...rowItems.map(item => item.box.getSize().y), 0);
    const assignments = new Map<number, FrameLayoutItem>();

    for (const item of [...withColumn].sort((a, b) => (a.column ?? 0) - (b.column ?? 0))) {
      let column = item.column ?? 0;

      while (assignments.has(column)) {
        column++;
      }
      assignments.set(column, item);
    }
    let nextColumn = 0;

    for (const item of withoutColumn) {
      while (assignments.has(nextColumn)) {
        nextColumn++;
      }
      assignments.set(nextColumn++, item);
    }

    let currentX = padding;

    for (const column of Array.from(assignments.keys()).sort((a, b) => a - b)) {
      const item = assignments.get(column)!;
      const { x: width, y: height } = item.box.getSize();

      placedItems.push({
        id: item.id,
        position: [currentX + width / 2, currentY + height / 2],
        x: currentX + width / 2,
        y: currentY + height / 2,
        row,
        column,
      });
      maxX = Math.max(maxX, currentX + width + padding);
      currentX += width + gap;
    }
    currentY += rowHeight + gap;
  }

  // 3. 根据已占用范围计算画板尺寸。
  return {
    items: placedItems,
    size: [Math.max(maxX, padding * 2), Math.max(currentY - gap + padding, padding * 2)],
  };
}

/**
 * 计算画板内元素的自动布局和画板尺寸。
 * @param items 待布局元素
 * @param options 布局间距与行约束
 * @returns 自动布局结果
 */
export function computeFrameAutoLayout (
  items: FrameLayoutItem[],
  options: FrameAutoLayoutOptions = {},
): FrameAutoLayoutResult {
  const padding = options.padding ?? 20;
  const gap = options.gap ?? 5;

  if (items.length === 0) {
    return { items: [], size: [padding * 2, padding * 2] };
  }

  const layout = items.some(item => item.row !== undefined)
    ? calculateMixedLayout(items, padding, gap)
    : calculateShelfLayout(items, padding, gap, options.config);

  return {
    items: layout.items.map(({ id, position, row, column }) => ({ id, position, row, column })),
    size: layout.size,
  };
}
