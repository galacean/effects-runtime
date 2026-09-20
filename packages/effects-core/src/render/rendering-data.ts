import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Camera } from '../camera';
import type { PostProcessVolume } from '../components';
import type { Texture } from '../texture';
import type { Framebuffer } from './framebuffer';
import { RenderList } from './scene-rendering';
import { ContextContainer } from './context-container';
import { ResourceData } from './resource-data';

/** Inputs for one scene render. The caller retains ownership of the target. */
export interface RenderOptions {
  camera: Camera,
  target?: Framebuffer | null,
  postProcessingEnabled?: boolean,
  globalVolume?: PostProcessVolume,
}

/** Data scoped to one render invocation, never stored on a shared pass. */
export class RenderingData {
  readonly renderList = new RenderList();
  readonly globalUniforms = new GlobalUniforms();
  readonly frameData = new ContextContainer();

  constructor (readonly options?: RenderOptions) {
    this.frameData.create(ResourceData);
  }
}

export function getTextureSize (tex?: Texture): Vector2 {
  return tex ? new Vector2(tex.getWidth(), tex.getHeight()) : new Vector2();
}

export class GlobalUniforms {
  floats: Record<string, number> = {};
  ints: Record<string, number> = {};
  vector3s: Record<string, Vector3> = {};
  vector4s: Record<string, Vector4> = {};
  matrices: Record<string, Matrix4> = {};
  textures: Record<string, Texture> = {};

  samplers: string[] = [];  // 存放的sampler名称。
  uniforms: string[] = [];  // 存放的uniform名称（不包括sampler）。
}
