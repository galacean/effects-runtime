import { Engine, Renderer } from '@galacean/effects-core';
import { ThreeEngine } from './three-engine';

export class ThreeRenderer extends Renderer {

  constructor (gl: WebGL2RenderingContext | WebGLRenderingContext) {
    super();
    this.engine = new ThreeEngine(gl);
  }
}
