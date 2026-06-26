import type { Sprite } from '@galacean/effects';
import { ImGui } from '../imgui';
import { getOrCreateTexturePreview, type TexturePreview } from './texture-preview';

/**
 * Sprite 缩略图：在整图纹理预览基础上叠加 sprite.rect（归一化 UV 子区域），
 * 供 sequencer 关键帧缩略图等场景复用。返回 imgui AddImage 所需的 {tex, uv0, uv1}。
 *
 * flipUv=Rotate90 暂不支持缩略图旋转（图集帧动画 flipUv=0）；如需旋转再镜像 sprite-item 逻辑。
 */
export type SpriteThumbnail = TexturePreview;

export function getSpriteThumbnail (sprite: Sprite): SpriteThumbnail | null {
  const base = getOrCreateTexturePreview(sprite.texture);

  if (!base) { return null; }

  // 整图预览 uv 已含 flipY 处理：flipped 时 uv0.y=1(图顶)、uv1.y=0(图底)
  const flipped = base.uv0.y > base.uv1.y;
  const [rx, ry, rw, rh] = sprite.rect;
  // rect 在原图空间：rx/ry 为左下角，rw/rh 为尺寸（y 自底向上）
  const uMin = rx;
  const uMax = rx + rw;
  // flipped：整图 uv.y=1 对应图顶，故 rect 底部(ry) → uv.y = 1-(ry+rh)，顶部(ry+rh) → uv.y = 1-ry
  // 非 flip：uv.y 与图空间 y 同向
  const vMin = flipped ? 1 - (ry + rh) : ry;
  const vMax = flipped ? 1 - ry : ry + rh;

  return {
    tex: base.tex,
    uv0: new ImGui.Vec2(uMin, vMin),
    uv1: new ImGui.Vec2(uMax, vMax),
  };
}
