import { AnimationPlayable } from './animation-playable';

export class AnimationStream {
  private playable: AnimationPlayable;
  private curveValues: Record<string, AnimationCurveValue> = {};

  constructor (playable: AnimationPlayable) {
    this.playable = playable;
  }

  setCurveValue (componentType: string, propertyName: string, value: number) {
    if (!this.findCurveValue(componentType, propertyName)) {
      this.curveValues[componentType + propertyName] = { componentType, propertyName, value };
    } else {
      this.curveValues[componentType + propertyName].value = value;
    }

    return this.curveValues[componentType + propertyName];
  }

  findCurveValue (componentType: string, propertyName: string) {
    return this.curveValues[componentType + propertyName];
  }

  getInputStream (index: number): AnimationStream | undefined {
    const inputPlayable = this.playable.getInput(index);

    if (inputPlayable instanceof AnimationPlayable) {
      return inputPlayable.animationStream;
    }
  }
}

export interface AnimationCurveValue {
  componentType: string,
  propertyName: string,
  value: number,
}