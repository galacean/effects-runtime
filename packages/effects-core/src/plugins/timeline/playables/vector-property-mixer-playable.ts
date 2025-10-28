import type { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { PropertyMixerPlayable } from './property-mixer-playable';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';

export class Vector4PropertyMixerPlayable extends PropertyMixerPlayable<Vector4> {
  override resetPropertyValue (): void {
    this.propertyValue.x = 0;
    this.propertyValue.y = 0;
    this.propertyValue.z = 0;
    this.propertyValue.w = 0;
  }

  override addWeightedValue (curveValue: Vector4, weight: number): void {
    const result = this.propertyValue;

    result.x += curveValue.x * weight;
    result.y += curveValue.y * weight;
    result.z += curveValue.z * weight;
    result.w += curveValue.w * weight;
  }
}

export class Vector3PropertyMixerPlayable extends PropertyMixerPlayable<Vector3> {
  override resetPropertyValue (): void {
    this.propertyValue.x = 0;
    this.propertyValue.y = 0;
    this.propertyValue.z = 0;
  }

  override addWeightedValue (curveValue: Vector3, weight: number): void {
    const result = this.propertyValue;

    result.x += curveValue.x * weight;
    result.y += curveValue.y * weight;
    result.z += curveValue.z * weight;
  }
}

export class Vector2PropertyMixerPlayable extends PropertyMixerPlayable<Vector2> {
  override resetPropertyValue (): void {
    this.propertyValue.x = 0;
    this.propertyValue.y = 0;
  }

  override addWeightedValue (curveValue: Vector2, weight: number): void {
    const result = this.propertyValue;

    result.x += curveValue.x * weight;
    result.y += curveValue.y * weight;
  }
}

