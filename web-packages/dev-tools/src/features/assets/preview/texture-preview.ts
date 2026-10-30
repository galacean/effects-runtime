import { Texture, TextureSourceType } from '@galacean/effects';
import { ImGui } from '../../../platform/imgui/index';
import type { ImGuiTexture } from '../../../platform/imgui/texture-binding';
import { texturePreviewCache, type PreviewTextureSource } from './texture-preview-cache';

export type TexturePreview = { tex: ImGuiTexture, uv0: ImGui.Vec2, uv1: ImGui.Vec2, corners?: [ImGui.Vec2, ImGui.Vec2, ImGui.Vec2, ImGui.Vec2] };

export function imageTexturePreview (image: { texture: ImGuiTexture, flipY?: boolean }): TexturePreview {
  return { tex: image.texture, uv0: new ImGui.Vec2(0, image.flipY ? 1 : 0), uv1: new ImGui.Vec2(1, image.flipY ? 0 : 1) };
}

export function drawTexturePreview (preview: TexturePreview, min: ImGui.Vec2, max: ImGui.Vec2): void {
  const draw = ImGui.GetWindowDrawList();

  if (preview.corners) {
    draw.AddImageQuad(preview.tex, min, new ImGui.Vec2(max.x, min.y), max, new ImGui.Vec2(min.x, max.y), ...preview.corners);
  } else { draw.AddImage(preview.tex, min, max, preview.uv0, preview.uv1); }
}

export function texturePreviewImage (preview: TexturePreview, size: ImGui.Vec2): void {
  const origin = ImGui.GetCursorScreenPos();

  ImGui.Dummy(size); drawTexturePreview(preview, origin, new ImGui.Vec2(origin.x + size.x, origin.y + size.y));
}

export function getOrCreateTexturePreview (texture: Texture, source: PreviewTextureSource = texture): TexturePreview | null {
  if (!(texture instanceof Texture) || texture.isDestroyed) { return null; }
  const flip = texture.source.sourceType === TextureSourceType.framebuffer || !!texture.source.flipY;

  return imageTexturePreview({ texture: texturePreviewCache.reference(source), flipY: flip });
}
