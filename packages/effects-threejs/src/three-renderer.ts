import { Renderer } from '@galacean/effects-core';
import { ThreeEngine } from './three-engine';

export class ThreeRenderer extends Renderer {
  constructor (gl: WebGL2RenderingContext | WebGLRenderingContext) {
    super();
    this.engine = new ThreeEngine(gl);
    this.engine.renderer = this;
    this.env = '';
    this.renderingData = {
      //@ts-expect-error
      currentFrame: {
      },
    };
  }
}
