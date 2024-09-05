import type { Engine } from '@galacean/effects-core';
import { spec, RendererComponent, effectsClass } from '@galacean/effects-core';

@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends RendererComponent {
  constructor (engine: Engine, public data: any) {
    super(engine);
  }
}
