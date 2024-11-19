import { effectsClass, serialize } from '../decorators';
import { Component } from './component';
import { EffectComponent } from './effect-component';

@effectsClass('Fake3DComponent')
export class Fake3DComponent extends Component {
  @serialize()
  loop = false;

  @serialize()
  amountOfMotion = 1.0;

  @serialize()
  animationLength = 2.0;

  @serialize()
  mode = Fake3DAnimationMode.Linear;

  @serialize()
  startPositionX = 0;
  @serialize()
  startPositionY = 0;
  @serialize()
  startPositionZ = 0;

  @serialize()
  endPositionX = 0;
  @serialize()
  endPositionY = 0;
  @serialize()
  endPositionZ = 0;

  @serialize()
  amplitudeX = 0;
  @serialize()
  amplitudeY = 0;
  @serialize()
  amplitudeZ = 0;

  @serialize()
  phaseX = 0;
  @serialize()
  phaseY = 0;
  @serialize()
  phaseZ = 0;

  effectComponent: EffectComponent;

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