import type { Box2 } from '@galacean/effects-math/es/extension/index';
import { Line2 } from '@galacean/effects-math/es/extension/index';
import { Vector2 } from '../math';
import type { LayoutInfo } from './types';

/** 自动布局兄弟元素的几何与位置信息。 */
export type SiblingInfo = {
  /** 元素 ID。 */
  id: string,
  /** 视图包围盒。 */
  box: Box2,
  /** 包围盒中心点。 */
  center: Vector2,
  /** 自动布局位置。 */
  layoutInfo?: LayoutInfo,
};

/** 自动布局插入指示器。 */
export type AutoLayoutIndicator = {
  /** 目标画板 ID。 */
  frameId: string,
  /** 在画板子元素列表中的插入索引。 */
  insertIndex: number,
  /** 相对参考元素的插入方向。 */
  insertDirection: 'before' | 'after',
  /** 参考兄弟元素 ID。 */
  targetSiblingId?: string,
  /** 插入指示线。 */
  line: Line2,
  /** 目标行号。 */
  targetRow?: number,
  /** 目标列号。 */
  targetColumn?: number,
} | null;

/** 自动布局中的行列位置。 */
export type LayoutPosition = {
  /** 行号。 */
  row: number,
  /** 列号。 */
  column: number,
};

/** 自动布局的插入位置及指示器依据。 */
export type InsertInfo = {
  /** 在画板子元素列表中的插入索引。 */
  index: number,
  /** 相对参考元素的插入方向。 */
  direction: 'before' | 'after',
  /** 参考兄弟元素 ID。 */
  siblingId?: string,
  /** 目标行号。 */
  row: number,
  /** 目标列号。 */
  column: number,
  /** 跨行移动信息。 */
  rowChange?: {
    /** 原行号。 */
    fromRow: number,
    /** 目标行号。 */
    toRow: number,
    /** 原行的视图边界。 */
    rowBounds?: {
      /** 最小 Y 坐标。 */
      minY: number,
      /** 最大 Y 坐标。 */
      maxY: number,
      /** 最小 X 坐标。 */
      minX: number,
      /** 最大 X 坐标。 */
      maxX: number,
    },
    /** 是否发生跨行移动。 */
    isRowChange: boolean,
  },
  /** 参考元素包围盒。 */
  box?: Box2,
};

/** 已解析行列位置的兄弟元素。 */
export type SiblingWithInfo = {
  /** 元素 ID。 */
  id: string,
  /** 视图包围盒。 */
  box: Box2,
  /** 行号。 */
  row: number,
  /** 列号。 */
  column: number,
  /** 包围盒中心 X 坐标。 */
  centerX: number,
};

/**
 * 按元素 `row` 字段分组的纯函数。
 * @param items 元素列表
 * @returns 按行号分组的 Map
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
 * 计算自动布局插入指示线。
 * @param insertInfo 插入位置信息
 * @returns 主指示线
 */
export function calculateAutoLayoutIndicatorLine (
  insertInfo: InsertInfo,
): Line2 {
  const LINE_EXTENSION = 10;
  const MOUSE_GAP = 5;
  const ROW_LINE_EXTENSION = 20;

  // 1. 跨行移动时生成原行边界的水平指示线。
  if (insertInfo.rowChange?.isRowChange && insertInfo.rowChange.rowBounds) {
    const bounds = insertInfo.rowChange.rowBounds;
    const isMovingUp = insertInfo.rowChange.toRow < insertInfo.rowChange.fromRow;

    const lineY = isMovingUp ? bounds.minY : bounds.maxY;

    return new Line2(
      new Vector2(bounds.minX - ROW_LINE_EXTENSION, lineY),
      new Vector2(bounds.maxX + ROW_LINE_EXTENSION, lineY)
    );
  }

  // 2. 同行移动时在参考元素前后生成垂直指示线。
  if (insertInfo.box) {
    const siblingBox = insertInfo.box;

    if (insertInfo.direction === 'before') {
      return new Line2(
        new Vector2(siblingBox.min.x - MOUSE_GAP, siblingBox.min.y - LINE_EXTENSION),
        new Vector2(siblingBox.min.x - MOUSE_GAP, siblingBox.max.y + LINE_EXTENSION)
      );
    } else {
      return new Line2(
        new Vector2(siblingBox.max.x + MOUSE_GAP, siblingBox.min.y - LINE_EXTENSION),
        new Vector2(siblingBox.max.x + MOUSE_GAP, siblingBox.max.y + LINE_EXTENSION)
      );
    }
  }

  return new Line2();
}

/**
 * 基于鼠标位置计算布局位置（row 和 column）。
 * @param mousePoint 鼠标位置
 * @param siblingInfos 所有兄弟元素的信息
 * @returns 布局位置信息 { row: number, column: number }
 */
export function calculateAutoLayoutPositionByMouse (
  mousePoint: Vector2,
  siblingInfos: SiblingInfo[],
): LayoutPosition | null {
  if (siblingInfos.length === 0) {
    return { row: 0, column: 0 };
  }

  const mouseY = mousePoint.y;
  const mouseX = mousePoint.x;

  // 1. 按已有行号分组并计算各行的垂直边界。
  const rowGroups = groupItemsByRow(siblingInfos.map(s => ({
    ...s,
    row: s.layoutInfo?.row !== undefined ? Math.floor(s.layoutInfo.row) : 0,
  })));

  let maxRow = 0;
  let minRow = 0;

  for (const row of rowGroups.keys()) {
    maxRow = Math.max(maxRow, row);
    minRow = Math.min(minRow, row);
  }

  /** 行的视图边界。 */
  type RowInfo = {
    /** 行号。 */
    row: number,
    /** 中心 Y 坐标。 */
    centerY: number,
    /** 上边界。 */
    minY: number,
    /** 下边界。 */
    maxY: number,
    /** 行高。 */
    height: number,
  };

  const rowInfos: RowInfo[] = [];

  for (const [row, items] of rowGroups) {
    const minY = Math.min(...items.map(i => i.box.min.y));
    const maxY = Math.max(...items.map(i => i.box.max.y));
    const centerY = (minY + maxY) / 2;
    const height = maxY - minY;

    rowInfos.push({ row, centerY, minY, maxY, height });
  }

  rowInfos.sort((a, b) => a.centerY - b.centerY);

  // 2. 按鼠标纵坐标确定命中行、首尾新行或最近行。
  let targetRow = 0;

  let foundRow = false;

  for (const currentRow of rowInfos) {
    if (mouseY >= currentRow.minY && mouseY <= currentRow.maxY) {
      targetRow = currentRow.row;
      foundRow = true;

      break;
    }
  }

  if (!foundRow && rowInfos.length > 0) {
    const firstRow = rowInfos[0];

    if (firstRow && mouseY < firstRow.minY) {
      targetRow = minRow - 1;
      foundRow = true;
    }
  }

  if (!foundRow && rowInfos.length > 0) {
    const lastRow = rowInfos[rowInfos.length - 1];

    if (lastRow && mouseY > lastRow.maxY) {
      targetRow = maxRow + 1;
      foundRow = true;
    }
  }

  if (!foundRow) {
    let minDistance = Infinity;

    for (const rowInfo of rowInfos) {
      const distance = Math.abs(mouseY - rowInfo.centerY);

      if (distance < minDistance) {
        minDistance = distance;
        targetRow = rowInfo.row;
      }
    }
  }

  // 3. 按鼠标横坐标确定目标行内的插入列。
  const targetRowItems = rowGroups.get(targetRow) ?? [];

  if (targetRowItems.length === 0) {
    return { row: targetRow, column: 0 };
  }

  targetRowItems.sort((a, b) => a.center.x - b.center.x);

  for (let i = 0; i < targetRowItems.length; i++) {
    const item = targetRowItems[i];

    if (item && mouseX < item.center.x) {
      return { row: targetRow, column: i };
    }
  }

  return { row: targetRow, column: targetRowItems.length };
}

/**
 * 基于鼠标位置计算插入位置（用于显示指示器）。
 * @param mousePoint 鼠标位置
 * @param siblingsWithInfos 所有兄弟元素信息
 * @param allChildren 所有兄弟元素ID数组
 * @param originalRow 原始行号
 * @returns 插入位置信息和计算出的行列位置
 */
export function calculateInsertPositionFromLayout (
  mousePoint: Vector2,
  siblingsWithInfos: SiblingWithInfo[],
  allChildren: string[],
  originalRow: number,
): InsertInfo {
  const mouseX = mousePoint.x;
  const mouseY = mousePoint.y;

  if (siblingsWithInfos.length === 0) {
    return { index: 0, direction: 'after', row: -1, column: 0 };
  }

  // 1. 按行分组并计算每行的视图边界。
  const rowGroups = groupItemsByRow(siblingsWithInfos);

  const rowBounds = new Map<number, { minY: number, maxY: number, minX: number, maxX: number }>();

  for (const [row, items] of rowGroups) {
    const minY = Math.min(...items.map(i => i.box.min.y));
    const maxY = Math.max(...items.map(i => i.box.max.y));
    const minX = Math.min(...items.map(i => i.box.min.x));
    const maxX = Math.max(...items.map(i => i.box.max.x));

    rowBounds.set(row, { minY, maxY, minX, maxX });
  }

  const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);

  // 2. 按鼠标纵坐标确定目标行及是否跨行。
  let targetRow = -1;

  for (const row of sortedRows) {
    const bounds = rowBounds.get(row);

    if (bounds && mouseY >= bounds.minY && mouseY <= bounds.maxY) {
      targetRow = row;

      break;
    }
  }

  if (targetRow === -1 && sortedRows.length > 0) {
    const firstRowNum = sortedRows[0];

    if (firstRowNum === undefined) {
      targetRow = -1;
    } else {
      const firstRowBounds = rowBounds.get(firstRowNum);

      if (firstRowBounds && mouseY < firstRowBounds.minY) {
        targetRow = -1;
      } else {
        targetRow = sortedRows[sortedRows.length - 1] ?? -1;
      }
    }
  }

  const currentRowBounds = rowBounds.get(originalRow);
  const isRowChange = targetRow !== originalRow;

  // 3. 在目标行中查找参考元素和插入索引。
  const targetRowItems = rowGroups.get(targetRow) ?? [];

  if (targetRowItems.length === 0) {
    let referenceItemId: string | null = null;

    for (const [row, items] of rowGroups) {
      if (row > targetRow && items.length > 0) {
        const firstItem = items[0];

        if (firstItem) {
          referenceItemId = firstItem.id;

          break;
        }
      }
    }

    if (!referenceItemId) {
      const lastRow = sortedRows[sortedRows.length - 1];
      const lastRowItems = lastRow !== undefined ? rowGroups.get(lastRow) ?? [] : [];

      referenceItemId = lastRowItems[lastRowItems.length - 1]?.id ?? null;
    }

    if (referenceItemId) {
      const refIndex = allChildren.indexOf(referenceItemId);

      if (refIndex !== -1) {
        return {
          index: targetRow === -1 ? refIndex : refIndex + 1,
          direction: targetRow === -1 ? 'before' : 'after',
          siblingId: referenceItemId,
          row: targetRow,
          column: targetRow === -1 ? 0 : (rowGroups.get(targetRow)?.length ?? 0),
          rowChange: isRowChange && currentRowBounds ? {
            fromRow: originalRow,
            toRow: targetRow,
            rowBounds: currentRowBounds,
            isRowChange,
          } : undefined,
          box: siblingsWithInfos.find(info => info.id === referenceItemId)?.box,
        };
      }
    }

    return {
      index: 0,
      direction: 'after',
      row: targetRow,
      column: 0,
      rowChange: isRowChange && currentRowBounds ? {
        fromRow: originalRow,
        toRow: targetRow,
        rowBounds: currentRowBounds,
        isRowChange,
      } : undefined,
    };
  }

  targetRowItems.sort((a, b) => a.centerX - b.centerX);

  for (const info of targetRowItems) {
    if (mouseX < info.centerX) {
      const refIndex = allChildren.indexOf(info.id);

      if (refIndex !== -1) {
        return {
          index: refIndex,
          direction: 'before',
          siblingId: info.id,
          row: targetRow,
          column: info.column,
          rowChange: isRowChange && currentRowBounds ? {
            fromRow: originalRow,
            toRow: targetRow,
            rowBounds: currentRowBounds,
            isRowChange: true,
          } : undefined,
          box: info.box,
        };
      }
    }
  }

  // 4. 鼠标位于目标行末尾时插入到最后一个元素之后。
  const lastItem = targetRowItems[targetRowItems.length - 1];

  if (lastItem) {
    const refIndex = allChildren.indexOf(lastItem.id);

    if (refIndex !== -1) {
      return {
        index: refIndex + 1,
        direction: 'after',
        siblingId: lastItem.id,
        row: targetRow,
        column: lastItem.column + 1,
        rowChange: isRowChange && currentRowBounds ? {
          fromRow: originalRow,
          toRow: targetRow,
          rowBounds: currentRowBounds,
          isRowChange: true,
        } : undefined,
        box: lastItem.box,
      };
    }
  }

  return {
    index: 0,
    direction: 'after',
    row: -1,
    column: 0,
    rowChange: isRowChange && currentRowBounds ? {
      fromRow: originalRow,
      toRow: targetRow,
      rowBounds: currentRowBounds,
      isRowChange: true,
    } : undefined,
  };
}
