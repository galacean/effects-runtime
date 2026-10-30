import { ImGuiContext } from 'maoan-imgui-js';

export interface ImGuiTextureDisplay { channels: [number, number, number, number], desaturate: boolean }

/** Resolves a borrowed texture at draw time, after scene rendering and resource replacement. */
export class ImGuiTextureBinding {
  constructor (readonly resolve: () => WebGLTexture | null, readonly premultipliedAlpha: boolean | (() => boolean) = false,
    readonly display?: () => ImGuiTextureDisplay) { }
}

export type ImGuiTexture = WebGLTexture | ImGuiTextureBinding;

export function resolveImGuiTexture (texture: ImGuiTexture): WebGLTexture | null {
  return texture instanceof ImGuiTextureBinding ? texture.resolve() : texture;
}

export function isImGuiTexturePremultiplied (texture: ImGuiTexture): boolean {
  return texture instanceof ImGuiTextureBinding && (typeof texture.premultipliedAlpha === 'function' ? texture.premultipliedAlpha() : texture.premultipliedAlpha);
}

export function getImGuiTextureDisplay (texture: ImGuiTexture): ImGuiTextureDisplay | undefined {
  return texture instanceof ImGuiTextureBinding ? texture.display?.() : undefined;
}
/** The backend's object-ID table outlives draw lists; drop submitted bindings so its slots can be reused. */
export function releaseImGuiTextureBindings (): void {
  const textures = Reflect.get(ImGuiContext, 'textures') as unknown[];

  for (let index = 0; index < textures.length; index++) {
    if (textures[index] instanceof ImGuiTextureBinding) { textures[index] = null; }
  }
}
