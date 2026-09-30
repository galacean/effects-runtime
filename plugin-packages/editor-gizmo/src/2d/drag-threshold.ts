/**
 * 鼠标拖拽轮次的起始距离（CSS px）。
 */
export const DRAG_THRESHOLD_PX = 5;

/**
 * 判断指针相对按下点的累计位移是否达到拖拽阈值。
 * @param startClientX 按下点 X 坐标
 * @param startClientY 按下点 Y 坐标
 * @param currentClientX 当前 X 坐标
 * @param currentClientY 当前 Y 坐标
 * @returns 是否达到拖拽阈值
 */
export function isDragThresholdReached (
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number,
): boolean {
  return Math.hypot(
    currentClientX - startClientX,
    currentClientY - startClientY,
  ) >= DRAG_THRESHOLD_PX;
}
