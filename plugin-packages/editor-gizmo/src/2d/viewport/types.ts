import type { Vector2 } from '../math';
import type { Box2 } from '@galacean/effects-math/es/extension/index';

/** 视口导航的缩放与平移边界。未提供的平移边界表示不设限。 */
export type ViewportNavigationRange = {
  minScale?: number,
  maxScale?: number,
  minTranslation?: Vector2,
  maxTranslation?: Vector2,
  /** 相对视口中心、scale=1 时的内容边界；提供时按当前缩放动态计算平移范围。 */
  translationBounds?: Box2,
};
