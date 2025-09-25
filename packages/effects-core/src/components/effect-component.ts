import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { MeshComponent } from './mesh-component';

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.EffectComponent)
export class EffectComponent extends MeshComponent {
  constructor (engine: Engine) {
    super(engine);
    this.name = 'EffectComponent';
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onUpdate (dt: number): void {
    const time = this.item.time;
    const _Time = this.material.getVector4('_Time') ?? new Vector4();

    this.material.setVector4('_Time', _Time.set(time / 20, time, time * 2, time * 3));

    this.item.time += dt / 1000;
  }

  override onEnable (): void {
    super.onEnable();
    this.item.time = 0;
  }

  override fromData (data: unknown): void {
    super.fromData(data);
    this.material = this.materials[0];
  }
}