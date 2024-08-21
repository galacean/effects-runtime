import * as spec from '@galacean/effects-specification';
import type { SceneRenderLevel } from './scene';

/**
 * 机型和渲染等级对应表
 *
 * 机型：B-低端机、A-中端机、S-高端机
 * 渲染等级：B-低、A-中、S-高、A+-中高、B+-全部
 *
 * - S（高端机）：高、全部、中高
 * - A（中端机）：中、全部、中高
 * - B（低端机）：低、全部
 * - undefined（全部机型）
 */
const renderLevelPassSet: Record<SceneRenderLevel, spec.RenderLevel[]> = {
  [spec.RenderLevel.S]: [spec.RenderLevel.S, spec.RenderLevel.BPlus, spec.RenderLevel.APlus],
  [spec.RenderLevel.A]: [spec.RenderLevel.A, spec.RenderLevel.BPlus, spec.RenderLevel.APlus],
  [spec.RenderLevel.B]: [spec.RenderLevel.B, spec.RenderLevel.BPlus],
};

export function passRenderLevel (l?: spec.RenderLevel, renderLevel?: SceneRenderLevel): boolean {
  if (!l || !renderLevel) {
    return true;
  }

  const arr = renderLevelPassSet[renderLevel];

  if (arr) {
    return arr.includes(l);
  }

  return false;
}
