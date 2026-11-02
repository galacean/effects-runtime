import type { Sprite } from '@galacean/effects';
import { SpriteRotation } from '@galacean/effects';
import { math } from '@galacean/effects';
import { getOrCreateTexturePreview, type TexturePreview } from './texture-preview';

export type SpriteThumbnail = TexturePreview & { width: number, height: number };

export function spriteRegionPreview (base: TexturePreview, rect: readonly number[], rotation: SpriteRotation): TexturePreview {
  const [x, y, w, h] = rect;
  const uv = (u: number, v: number) => new math.Vector2(u, base.uv1.y + (base.uv0.y - base.uv1.y) * v);
  const corners: NonNullable<TexturePreview['corners']> = rotation === SpriteRotation.Rotate90
    ? [uv(x, y), uv(x, y + w), uv(x + h, y + w), uv(x + h, y)]
    : [uv(x, y + h), uv(x + w, y + h), uv(x + w, y), uv(x, y)];

  return { tex: base.tex, uv0: corners[0], uv1: corners[2], corners };
}

export function getSpriteThumbnail (sprite: Sprite): SpriteThumbnail | null {
  const base = getOrCreateTexturePreview(sprite.texture, () => sprite.texture);

  if (!base) { return null; }
  const rotated = sprite.rotation === SpriteRotation.Rotate90;

  return { ...spriteRegionPreview(base, sprite.rect, sprite.rotation),
    width: (rotated ? sprite.texture.height : sprite.texture.width) * sprite.rect[2], height: (rotated ? sprite.texture.width : sprite.texture.height) * sprite.rect[3] };
}
