import type {
  GeometryMeshProps, FramebufferProps, RenderbufferProps,
  TextureDataType, TextureSourceOptions, EngineOptions,

  Renderer } from '@galacean/effects-core';
import {
  Framebuffer, glContext, imageDataFromColor, Mesh, Renderbuffer, Texture, TextureSourceType, Engine, RenderingDevice, logger,
} from '@galacean/effects-core';
import {
  GLFramebuffer, GLRenderbuffer, RenderingDeviceWebGL,
} from '@galacean/effects-webgl';

export { RenderingDeviceWebGL } from '@galacean/effects-webgl';
export * from '@galacean/effects-core';
export * from './types';
export * from './player';
export { isCanvasUsedByPlayer, getPlayerByCanvas, getActivePlayers } from './player-map';

Texture.create = (engine: Engine, props?: TextureSourceOptions) => {
  return new Texture(engine, props);
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
    generateMipmap = false,
  } = options as TextureSourceOptions;
  const tex = new Texture(
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
      generateMipmap,
    } as unknown as TextureSourceOptions);

  return tex;
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

RenderingDevice.create = engine => new RenderingDeviceWebGL(engine);

Engine.create = (canvas: HTMLCanvasElement, options?: EngineOptions) => {
  return new Engine(canvas, options);
};

/**
 * Player 版本号
 */
export const version = __VERSION__;

logger.info(`Player version: ${version}.`);
