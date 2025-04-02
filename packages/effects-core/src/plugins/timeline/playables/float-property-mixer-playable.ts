import { PropertyMixerPlayable } from './property-mixer-playable';

export class FloatPropertyMixerPlayable extends PropertyMixerPlayable<number> {
  override resetPropertyValue (): void {
    this.propertyValue = 0;
  }

  override addWeightedValue (curveValue: number, weight: number): void {
    this.propertyValue += curveValue * weight;
  }
}

