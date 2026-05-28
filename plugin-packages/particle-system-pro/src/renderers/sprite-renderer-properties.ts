import { spec } from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import { ProRendererProperties } from './renderer-properties';

/**
 * Sprite 朝向模式。
 *
 * - billboard：始终面向摄像机（默认；普通 Sprite 粒子）
 * - velocity：宽度方向永远垂直速度（火花/雨滴/激光等沿运动方向拉长）
 *   Y 轴是 velocity，X 轴是 cross(viewDir, velocity)
 * - unaligned：不做 billboard，quad 在物体局部 XY 平面展开（地面粒子、弹孔等）
 *   对齐 UE ENiagaraSpriteAlignment::Unaligned
 */
export type ProSpriteFacingMode = 'billboard' | 'velocity' | 'unaligned';

/**
 * Sprite 排序模式。
 *
 * - none：不排序（按 spawn 顺序），性能最高，适合 ADD 混合
 * - viewDepth：按相机视空间 Z 排序（最远的先画），ALPHA 混合标配
 * - distance：按到相机距离排序（远到近）
 * - age：按粒子年龄排序（老的先画 = 先 spawn 的在底层）
 */
export type ProSpriteSortMode = 'none' | 'viewDepth' | 'distance' | 'age';

/**
 * Sprite Renderer 的编辑期配置。
 *
 * - texture：粒子贴图（null 时 shader 不采样，纯用颜色）
 * - blending：混合模式（默认 ALPHA；火/烟雾常用 ADD）
 * - facingMode：粒子朝向策略（billboard / velocity）
 * - subUVRows/Cols/Total：SubUV 序列帧网格；total 0/1 时关闭
 */
export class ProSpriteRendererProperties extends ProRendererProperties {
  texture: Texture | null = null;
  blending: spec.BlendingMode = spec.BlendingMode.ALPHA;
  facingMode: ProSpriteFacingMode = 'billboard';
  sortMode: ProSpriteSortMode = 'none';
  subUVRows = 1;
  subUVCols = 1;
  subUVTotal = 1;
}
