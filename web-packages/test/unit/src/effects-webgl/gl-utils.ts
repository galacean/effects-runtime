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
