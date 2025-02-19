import type { Color } from '@galacean/effects-math/es/core/color';
import { PropertyMixerPlayable } from './property-mixer-playable';

export class ColorPropertyMixerPlayable extends PropertyMixerPlayable<Color> {
  override resetPropertyValue (): void {
    this.propertyValue.setZero();
  }

  override addWeightedValue (curveValue: Color, weight: number): void {
    const result = this.propertyValue;

    result.r += curveValue.r * weight;
    result.g += curveValue.g * weight;
    result.b += curveValue.b * weight;
    result.a += curveValue.a * weight;
  }
}

