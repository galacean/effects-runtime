import type { Box2 } from '@galacean/effects-math/es/extension/index';

/** 画板布局模式。 */
export enum FrameLayoutMode {
  /** 自动布局：元素按行列规则自动排布。 */
  AUTO = 'auto',
  /** 自由布局：元素位置不受布局约束。 */
  FREE = 'free'
}

/** 画板数据及其当前视图包围盒。 */
export type FrameInfo = {
  /** 画板元素 ID。 */
  id: string,
  /** 当前视图包围盒。 */
  box: Box2,
  /** 布局模式。 */
  layoutMode: FrameLayoutMode,
  /** 子元素 ID。 */
  children: string[],
  /** 子元素自动布局信息。 */
  layoutInfos: Record<string, LayoutInfo>,
};

/** 元素在自动布局中的位置信息。 */
export type LayoutInfo = {
  /**
   * 所在行号（可为小数）。
   * 整数部分为主行号（0, 1, 2...），小数部分为分行后的子行号（如 1.5 表示第 1 行的第 5 个子行），
   * 仅支持两层（即小数部分为 0-9）。
   */
  row: number,
  /** 所在列号（必须为整数）。 */
  column: number,
  /** 元素在布局中的位置（相对于画板左上角，可选）。 */
  position?: [number, number],
};

/** 画板自动布局约束。 */
export type AutoLayoutConfig = {
  /** 单行最大宽度。 */
  maxRowWidth?: number,
  /** 最大行数。 */
  maxRowCount?: number,
};
