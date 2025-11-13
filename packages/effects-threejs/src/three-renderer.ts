import type { Engine } from '@galacean/effects-core';
import { Renderer } from '@galacean/effects-core';

export class ThreeRenderer extends Renderer {
  constructor (engine: Engine) {
    super(engine);
    this.renderingData = {
      //@ts-expect-error
      currentFrame: {
      },
    };
  }
}
