import type * as spec from '@galacean/effects-specification';
import { particleOriginTranslateMap } from './math';

/**
 * 提取并转换 JSON 数据中的 anchor 值
 */
export function convertAnchor (anchor?: spec.vec2, particleOrigin?: spec.ParticleOrigin): spec.vec2 {
  if (anchor) {
    return [anchor[0] - 0.5, 0.5 - anchor[1]];
  } else if (particleOrigin) {
    return particleOriginTranslateMap[particleOrigin];
  } else {
    return [0, 0];
  }
}
