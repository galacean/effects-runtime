import { spec } from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import { ProRendererProperties } from './renderer-properties';

/**
 * Sprite Renderer 的编辑期配置。
 *
 * - texture：粒子贴图（null 时 shader 不采样，纯用颜色）
 * - blending：混合模式（默认 ALPHA；火/烟雾常用 ADD）
 * - billboard：是否始终面向摄像机（Phase 3 暂未实现 非billboard，保留字段）
 * - subUVRows/Cols/Total：SubUV 序列帧网格；total 0/1 时关闭
 */
export class ProSpriteRendererProperties extends ProRendererProperties {
  texture: Texture | null = null;
  blending: spec.BlendingMode = spec.BlendingMode.ALPHA;
  billboard = true;
  subUVRows = 1;
  subUVCols = 1;
  subUVTotal = 1;
}
