export function getGL () {
  const webglCanvas = document.createElement('canvas');

  return webglCanvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    alpha: true,
    stencil: true,
    antialias: true,
    premultipliedAlpha: true,
  });
}

export function getGL2 () {
  const webgl2Canvas = document.createElement('canvas');

  return webgl2Canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    alpha: true,
    stencil: true,
    antialias: true,
    premultipliedAlpha: true,
  });
}
