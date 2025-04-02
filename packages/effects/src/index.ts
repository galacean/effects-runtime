import type {
  GeometryMeshProps, GeometryProps, FramebufferProps, MaterialProps, RenderbufferProps,
  TextureDataType, TextureSourceOptions, GLType,
} from '@galacean/effects-core';
import {
  Framebuffer, Geometry, glContext, imageDataFromColor, Material, Mesh, Renderbuffer,
  Renderer, Texture, TextureSourceType, Engine, logger,
} from '@galacean/effects-core';
import {
  GLFramebuffer, GLGeometry, GLMaterial, GLRenderbuffer, GLRenderer, GLTexture, GLEngine,
} from '@galacean/effects-webgl';

export { GLGeometry, GLEngine, GLRenderer } from '@galacean/effects-webgl';
export * from '@galacean/effects-core';
export * from './types';
export * from './player';
export { isCanvasUsedByPlayer, getPlayerByCanvas, getActivePlayers } from './player-map';

Texture.create = (engine: Engine, props?: TextureSourceOptions) => {
  return new GLTexture(engine, props);
};

Texture.createWithData = (
  engine: Engine,
  data: TextureDataType = imageDataFromColor('#fff'),
  options = {},
) => {
  const {
    type = glContext.UNSIGNED_BYTE,
    format = glContext.RGBA,
    internalFormat,
    wrapS = glContext.MIRRORED_REPEAT,
    wrapT = glContext.MIRRORED_REPEAT,
    minFilter = glContext.NEAREST,
    magFilter = glContext.NEAREST,
    flipY = false,
  } = options as TextureSourceOptions;
  const tex = new GLTexture(
    engine,
    {
      data,
      type,
      sourceType: TextureSourceType.data,
      format,
      internalFormat: internalFormat || format,
      wrapS,
      wrapT,
      minFilter,
      magFilter,
      flipY,
    } as unknown as TextureSourceOptions);

  return tex;
};

Material.create = (engine: Engine, props?: MaterialProps) => {
  return new GLMaterial(engine, props);
};

Geometry.create = (engine: Engine, props?: GeometryProps) => {
  return new GLGeometry(engine, props);
};

Mesh.create = (engine: Engine, props?: GeometryMeshProps) => {
  return new Mesh(engine, props);
};

Renderbuffer.create = (props: RenderbufferProps) => {
  return new GLRenderbuffer(props);
};

Framebuffer.create = (props: FramebufferProps, renderer: Renderer) => {
  return new GLFramebuffer(props, renderer);
};

Renderer.create = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  framework: GLType,
  renderOptions?: WebGLContextAttributes,
) => {
  return new GLRenderer(canvas, framework, renderOptions);
};

Engine.create = (gl: WebGLRenderingContext | WebGL2RenderingContext) => {
  return new GLEngine(gl);
};

/**
 * Player 版本号
 */
export const version = __VERSION__;

logger.info(`Player version: ${version}.`);
