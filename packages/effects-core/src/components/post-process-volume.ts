import { effectsClass, serialize } from '../decorators';
import { Behaviour } from './component';

// TODO spec 增加 DataType
@effectsClass('PostProcessVolume')
export class PostProcessVolume extends Behaviour {
  // Bloom
  @serialize()
  bloomEnabled = true;
  @serialize()
  threshold = 1.0;
  @serialize()
  bloomIntensity = 1.0;

  // ColorAdjustments
  @serialize()
  brightness = 1.0;
  @serialize()
  saturation = 1.0;
  @serialize()
  contrast = 1.0;

  // Vignette
  @serialize()
  vignetteIntensity = 0.2;
  @serialize()
  vignetteSmoothness = 0.4;
  @serialize()
  vignetteRoundness = 1.0;

  // ToneMapping
  @serialize()
  toneMappingEnabled: boolean = true; // 1: true, 0: false

  override onStart (): void {
    const composition = this.item.composition;

    if (composition) {
      composition.renderFrame.globalVolume = this;
    }
  }
}
