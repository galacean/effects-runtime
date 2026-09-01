import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import { Component } from './component';
import { EffectComponent } from './effect-component';

interface Fake3DComponentData extends spec.ComponentData {
  loop?: boolean,
  amountOfMotion?: number,
  animationLength?: number,
  mode?: Fake3DAnimationMode,
  startPositionX?: number,
  startPositionY?: number,
  startPositionZ?: number,
  endPositionX?: number,
  endPositionY?: number,
  endPositionZ?: number,
  amplitudeX?: number,
  amplitudeY?: number,
  amplitudeZ?: number,
  phaseX?: number,
  phaseY?: number,
  phaseZ?: number,
}

@effectsClass('Fake3DComponent')
export class Fake3DComponent extends Component {
  loop = false;

  amountOfMotion = 1.0;

  animationLength = 2.0;

  mode = Fake3DAnimationMode.Linear;

  startPositionX = 0;
  startPositionY = 0;
  startPositionZ = 0;

  endPositionX = 0;
  endPositionY = 0;
  endPositionZ = 0;

  amplitudeX = 0;
  amplitudeY = 0;
  amplitudeZ = 0;

  phaseX = 0;
  phaseY = 0;
  phaseZ = 0;

  effectComponent: EffectComponent;

  override fromData (data: Fake3DComponentData): void {
    super.fromData(data);
    if (data.loop !== undefined) { this.loop = data.loop; }
    if (data.amountOfMotion !== undefined) { this.amountOfMotion = data.amountOfMotion; }
    if (data.animationLength !== undefined) { this.animationLength = data.animationLength; }
    if (data.mode !== undefined) { this.mode = data.mode; }
    if (data.startPositionX !== undefined) { this.startPositionX = data.startPositionX; }
    if (data.startPositionY !== undefined) { this.startPositionY = data.startPositionY; }
    if (data.startPositionZ !== undefined) { this.startPositionZ = data.startPositionZ; }
    if (data.endPositionX !== undefined) { this.endPositionX = data.endPositionX; }
    if (data.endPositionY !== undefined) { this.endPositionY = data.endPositionY; }
    if (data.endPositionZ !== undefined) { this.endPositionZ = data.endPositionZ; }
    if (data.amplitudeX !== undefined) { this.amplitudeX = data.amplitudeX; }
    if (data.amplitudeY !== undefined) { this.amplitudeY = data.amplitudeY; }
    if (data.amplitudeZ !== undefined) { this.amplitudeZ = data.amplitudeZ; }
    if (data.phaseX !== undefined) { this.phaseX = data.phaseX; }
    if (data.phaseY !== undefined) { this.phaseY = data.phaseY; }
    if (data.phaseZ !== undefined) { this.phaseZ = data.phaseZ; }
  }

  override onStart (): void {
    this.effectComponent = this.item.getComponent(EffectComponent);
  }

  override onUpdate (dt: number): void {
    this.updateFake3D();
  }

  updateFake3D () {
    if (!this.effectComponent) {
      return;
    }

    const time = this.item.time % this.animationLength / this.animationLength;

    let _PosX = 0;
    let _PosY = 0;
    let _PosZ = 0;

    switch (this.mode) {
      case Fake3DAnimationMode.Circular:{
        const PI = Math.PI;

        _PosX = Math.sin(2.0 * PI * (time + this.phaseX)) * this.amplitudeX;
        _PosY = Math.sin(2.0 * PI * (time + this.phaseY)) * this.amplitudeY;
        _PosZ = Math.sin(2.0 * PI * (time + this.phaseZ)) * this.amplitudeZ;

        break;
      }
      case Fake3DAnimationMode.Linear:{
        let localTime = time;

        if (this.loop) {
          if (localTime > 0.5) {
            localTime = 1 - localTime;
          }

          localTime *= 2;
        }

        _PosX = this.startPositionX * (1 - localTime) + localTime * this.endPositionX;
        _PosY = this.startPositionY * (1 - localTime) + localTime * this.endPositionY;
        _PosZ = this.startPositionZ * (1 - localTime) + localTime * this.endPositionZ;

        break;
      }
    }

    const material = this.effectComponent.material;

    material.setFloat('_PosX', _PosX * this.amountOfMotion);
    material.setFloat('_PosY', _PosY * this.amountOfMotion);
    material.setFloat('_PosZ', _PosZ * this.amountOfMotion);
  }
}

export enum Fake3DAnimationMode {
  Circular,
  Linear
}
