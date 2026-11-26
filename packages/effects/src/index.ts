import type {
  GeometryMeshProps, TextureDataType, TextureSourceOptions, EngineOptions,
} from '@galacean/effects-core';
import {
  glContext, imageDataFromColor, Mesh, Texture, TextureSourceType, Engine, RenderingDevice, logger,
} from '@galacean/effects-core';
import {
  RenderingDeviceWebGL,
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
  options: TextureSourceOptions = {},
) => {
  return new Texture(engine, {
    ...options,
    data,
    sourceType: TextureSourceType.data,
    target: glContext.TEXTURE_2D,
    wrapS: options.wrapS ?? glContext.MIRRORED_REPEAT,
    wrapT: options.wrapT ?? glContext.MIRRORED_REPEAT,
    flipY: options.flipY ?? false,
    generateMipmap: options.generateMipmap ?? false,
  });
};

Mesh.create = (engine: Engine, props?: GeometryMeshProps) => {
  return new Mesh(engine, props);
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
