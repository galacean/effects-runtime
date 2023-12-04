import { Vector3, clamp } from '@galacean/effects-math/es/core/index';
import { getArcAngle } from './cone';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from '.';

export class TextureShape implements Shape {
  width: number;
  height: number;
  block: number[];
  anchors: Float32Array;
  arcMode: number;
  random: number;

  constructor (arg: any) {
    const detail = arg.detail || { anchors: [0.5, 0.5], block: [0, 0] };

    this.anchors = new Float32Array(detail.anchors);
    this.width = arg.width || 1;
    this.height = arg.height || 1;
    this.block = detail.block;
    this.arcMode = arg.arcMode;
    this.random = clamp(arg.random || 0, 0, 1);
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const anchors = this.anchors;
    const pointCount = (anchors.length / 2 - 1);
    const index = Math.floor(getArcAngle(pointCount, this.arcMode, opt));

    const pointX = (anchors[index * 2] + this.block[0] * this.random * Math.random()) % 1 - 0.5;
    const pointY = (anchors[index * 2 + 1] + this.block[1] * this.random * Math.random()) % 1 - 0.5;
    const dir = new Vector3(pointX, pointY, 0);

    return {
      position: new Vector3(pointX * this.width, pointY * this.height, 0),
      direction: dir.normalize(),
    };
  }
}
