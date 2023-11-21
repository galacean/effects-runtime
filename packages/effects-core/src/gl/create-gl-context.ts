/**
 * Helper class to create a WebGL Context
 *
 * @param canvas
 * @param glType
 * @param options
 * @returns
 */
export function createGLContext (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  glType: 'webgl' | 'webgl2' = 'webgl',
  options: WebGLContextAttributes,
): WebGLRenderingContext | WebGL2RenderingContext {
  let context: WebGLRenderingContext | WebGL2RenderingContext | undefined;

  if (glType === 'webgl2') {
    context = canvas.getContext('webgl2', options) as WebGL2RenderingContext;
    if (!context) {
      console.debug('WebGL2 context retrieval failed, falling back to WebGL context.');
    }
  }
  if (!context || glType === 'webgl') {
    context = canvas.getContext('webgl', options) as WebGLRenderingContext;
  }
  if (!context) {
    throw new Error('This browser does not support WebGL or the WebGL version is incorrect. Please check your WebGL version.');
  }

  return context;
}
