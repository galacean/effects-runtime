import * as spec from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/index';
import { Circle, Edge, Rectangle, RectangleEdge } from './2d-shape';
import { Cone } from './cone';
import { Donut } from './donut';
import { Hemisphere, Sphere } from './sphere';
import { TextureShape } from './texture-shape';

export type ShapeGeneratorOptions = {
  total: number,
  index: number,
  burstIndex: number,
  burstCount: number,
};

export type ShapeParticle = {
  direction: Vector3,
  position: Vector3,
};

export interface Shape {
  generate (options: ShapeGeneratorOptions): ShapeParticle,
}

export type ShapeGenerator =
  Shape
  & { reverseDirection?: boolean, alignSpeedDirection?: boolean, upDirection?: Vector3 };

class ShapeNone implements Shape {
  generate () {
    return {
      position: new Vector3(),
      direction: new Vector3(),
    };
  }
}

const map: Record<string, { new(options: Record<string, any>): ShapeGenerator }> = {
  [spec.ShapeType.NONE]: ShapeNone,
  [spec.ShapeType.CONE]: Cone,
  [spec.ShapeType.SPHERE]: Sphere,
  [spec.ShapeType.HEMISPHERE]: Hemisphere,
  [spec.ShapeType.CIRCLE]: Circle,
  [spec.ShapeType.DONUT]: Donut,
  [spec.ShapeType.RECTANGLE]: Rectangle,
  [spec.ShapeType.EDGE]: Edge,
  [spec.ShapeType.RECTANGLE_EDGE]: RectangleEdge,
  [spec.ShapeType.TEXTURE]: TextureShape,
};

export function createShape (shapeOptions: spec.ParticleShape): Shape {
  if (!shapeOptions) {
    return new ShapeNone();
  }
  const options = {
    radius: 1,
    arc: 360,
    angle: 0,
    arcMode: spec.ShapeArcMode.RANDOM,
    ...shapeOptions,
  };
  const { type } = shapeOptions;
  const Ctrl = map[type];

  if (!Ctrl) {
    throw Error('invalid shape:' + type);
  }
  const ctrl = new Ctrl(options);

  if (type !== spec.ShapeType.NONE) {
    const { alignSpeedDirection, upDirection = [0, 0, 1] } = shapeOptions as spec.ParticleShapeBase;

    ctrl.alignSpeedDirection = alignSpeedDirection;
    ctrl.upDirection = Vector3.fromArray(upDirection).normalize();
  }

  return ctrl;
}
