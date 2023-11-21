import type {
  GeometryMeshProps, GeometryProps,
  FrameBufferProps,
  MaterialProps, RenderBufferProps, TextureDataType, TextureSourceOptions,
} from '@galacean/effects-core';
import {
  FrameBuffer, Geometry, glContext, imageDataFromColor, Material,
  Mesh, RenderBuffer, Renderer, Texture, TextureSourceType, Engine, LOG_TYPE,
} from '@galacean/effects-core';
import { GLFrameBuffer, GLGeometry, GLMaterial, GLRenderBuffer, GLRenderer, GLTexture, GLEngine } from '@galacean/effects-webgl';

export { GLGeometry, GLEngine, GLRenderer } from '@galacean/effects-webgl';
export * from '@galacean/effects-core';
export * from './player';

Texture.create = (engine: Engine, props: TextureSourceOptions) => {
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

Material.create = (engine: Engine, props: MaterialProps) => {
  return new GLMaterial(engine, props);
};

Geometry.create = (engine: Engine, props: GeometryProps) => {
  return new GLGeometry(engine, props);
};

Mesh.create = (engine: Engine, props: GeometryMeshProps) => {
  return new Mesh(engine, props);
};

RenderBuffer.create = (props: RenderBufferProps) => {
  return new GLRenderBuffer(props);
};

FrameBuffer.create = (props: FrameBufferProps, renderer: Renderer) => {
  return new GLFrameBuffer(props, renderer);
};

Renderer.create = (canvas: HTMLCanvasElement | OffscreenCanvas,
  framework: 'webgl' | 'webgl2',
  renderOptions?: WebGLContextAttributes) => {
  return new GLRenderer(canvas, framework, renderOptions);
};

Engine.create = (gl: WebGLRenderingContext | WebGL2RenderingContext) => {
  return new GLEngine(gl);
};

export const version = __VERSION__;
console.info({
  content: '[Galacean Effects Player] version: ' + __VERSION__,
  type: LOG_TYPE,
});
