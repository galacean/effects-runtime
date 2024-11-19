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
  [spec.ParticleEmitterShapeType.NONE]: ShapeNone,
  [spec.ParticleEmitterShapeType.CONE]: Cone,
  [spec.ParticleEmitterShapeType.SPHERE]: Sphere,
  [spec.ParticleEmitterShapeType.HEMISPHERE]: Hemisphere,
  [spec.ParticleEmitterShapeType.CIRCLE]: Circle,
  [spec.ParticleEmitterShapeType.DONUT]: Donut,
  [spec.ParticleEmitterShapeType.RECTANGLE]: Rectangle,
  [spec.ParticleEmitterShapeType.EDGE]: Edge,
  [spec.ParticleEmitterShapeType.RECTANGLE_EDGE]: RectangleEdge,
  [spec.ParticleEmitterShapeType.TEXTURE]: TextureShape,
};

export function createShape (shapeOptions?: spec.ParticleShape): Shape {
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
    throw new Error(`Invalid shape: ${type}.`);
  }
  const ctrl = new Ctrl(options);

  if (type !== spec.ParticleEmitterShapeType.NONE) {
    const { alignSpeedDirection, upDirection = [0, 0, 1] } = shapeOptions as spec.ParticleShapeBase;

    ctrl.alignSpeedDirection = alignSpeedDirection;
    ctrl.upDirection = Vector3.fromArray(upDirection).normalize();
  }

  return ctrl;
}
