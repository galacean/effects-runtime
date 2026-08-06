import type { DataBuffer } from '@galacean/effects-core';

export function getGL () {
  const glCanvas = document.createElement('canvas');

  return glCanvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    alpha: true,
    stencil: true,
    antialias: true,
    premultipliedAlpha: true,
  });
}

export function getGL2 () {
  const gl2Canvas = document.createElement('canvas');

  return gl2Canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    alpha: true,
    stencil: true,
    antialias: true,
    premultipliedAlpha: true,
  });
}

export function readBufferContents (
  gl: WebGL2RenderingContext,
  dataBuffer: DataBuffer,
  destination: ArrayBufferView,
  byteOffset = 0,
  indexBuffer = false,
): void {
  const target = indexBuffer ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

  gl.bindBuffer(target, dataBuffer.underlyingResource as WebGLBuffer);
  gl.getBufferSubData(target, byteOffset, destination);
}
