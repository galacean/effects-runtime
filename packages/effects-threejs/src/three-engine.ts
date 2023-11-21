import { Engine, GPUCapability } from '@galacean/effects-core';

export class ThreeEngine extends Engine {
  constructor (gl: WebGL2RenderingContext | WebGLRenderingContext) {
    super();
    this.gpuCapability = new GPUCapability(gl);
  }
}
