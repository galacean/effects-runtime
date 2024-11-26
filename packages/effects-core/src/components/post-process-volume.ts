import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../decorators';
import { Behaviour } from './component';
import type { Engine } from '../engine';

/**
 * @since 2.1.0
 */
@effectsClass(spec.DataType.PostProcessVolume)
export class PostProcessVolume extends Behaviour {

  @serialize()
  bloom: spec.Bloom;

  @serialize()
  vignette: spec.Vignette;

  @serialize()
  tonemapping: spec.Tonemapping;

  @serialize()
  colorAdjustments: spec.ColorAdjustments;

  constructor (engine: Engine) {
    super(engine);

    this.bloom = {
      threshold: 0,
      intensity: 0,
      active: false,
    };

    this.vignette = {
      intensity: 0,
      smoothness: 0,
      roundness: 0,
      active: false,
    };

    this.tonemapping = {
      active: false,
    };

    this.colorAdjustments = {
      brightness: 0,
      saturation: 0,
      contrast: 0,
      active: false,
    };
  }

  override onStart (): void {
    const composition = this.item.composition;

    if (composition) {
      composition.renderFrame.globalVolume = this;
    }
  }
}
