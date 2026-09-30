import { Vector2 } from '../math';
import { Box2 } from '@galacean/effects-math/es/extension/index';

/**
 * 计算内容两端分别对齐视口两端时的平移区间。
 * @param bounds 相对视口中心、scale=1 时的内容边界
 * @param scale 当前缩放
 * @param size 视口像素尺寸
 */
export function getViewportTranslationRange (bounds: Box2, scale: number, size: Vector2): Box2 {
  const start = bounds.min.clone().multiply(-scale).subtract(size.clone().divide(2));
  const end = bounds.max.clone().multiply(-scale).add(size.clone().divide(2));

  // 内容大于视口时允许浏览两端；小于视口时允许在屏幕内移动。
  return new Box2(
    new Vector2(Math.min(start.x, end.x), Math.min(start.y, end.y)),
    new Vector2(Math.max(start.x, end.x), Math.max(start.y, end.y)),
  );
}
