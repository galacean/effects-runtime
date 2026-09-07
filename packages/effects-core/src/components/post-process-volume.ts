import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import { Component } from './component';
import type { Engine } from '../engine';

/**
 * @since 2.1.0
 */
@effectsClass(spec.DataType.PostProcessVolume)
export class PostProcessVolume extends Component {

  bloom: spec.Bloom;

  vignette: spec.Vignette;

  tonemapping: spec.Tonemapping;

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

  override fromData (data: spec.PostProcessVolumeData): void {
    super.fromData(data);
    if (data.bloom !== undefined) { this.bloom = { ...data.bloom }; }
    if (data.vignette !== undefined) { this.vignette = { ...data.vignette }; }
    if (data.tonemapping !== undefined) { this.tonemapping = { ...data.tonemapping }; }
    if (data.colorAdjustments !== undefined) { this.colorAdjustments = { ...data.colorAdjustments }; }
  }

  override onStart (): void {
    const composition = this.item.composition;

    if (composition) {
      composition.renderFrame.globalVolume = this;
    }
  }
}
