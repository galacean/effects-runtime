import type { vec3, vec4 } from '@galacean/effects-specification';
import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter, vecAdd, vecAssign, clamp } from '../../math';
import { Transform } from '../../transform';

export class CameraController {
  near: number;
  far: number;
  fov: number;
  clipMode?: spec.CameraClipMode;
  position: vec3;
  rotation: vec3;

  private options: {
    position: vec3,
    rotation: vec3,
    near: ValueGetter<number>,
    far: ValueGetter<number>,
    fov: ValueGetter<number>,
  };
  private readonly translateOverLifetime?: {
    path?: ValueGetter<vec3>,
    x: ValueGetter<number>,
    y: ValueGetter<number>,
    z: ValueGetter<number>,
  };
  private readonly rotationOverLifetime?: {
    separateAxes?: boolean,
    x: ValueGetter<number>,
    y: ValueGetter<number>,
    z: ValueGetter<number>,
    rotation?: ValueGetter<number>,
  };

  constructor (
    private readonly transform: Transform,
    model: spec.CameraContent,
  ) {
    const {
      position = [0, 0, 0],
    } = transform;
    const rotation = transform.getRotation();
    const { near, far, fov, clipMode } = model.options;

    this.clipMode = clipMode;
    this.options = {
      position: vecAssign([0, 0, 0], position, 3),
      rotation: vecAssign([0, 0, 0], rotation, 3),
      near: createValueGetter(near),
      far: createValueGetter(far),
      fov: createValueGetter(fov),
    };
    if (model.positionOverLifetime) {
      const { path, linearX = 0, linearY = 0, linearZ = 0 } = model.positionOverLifetime;

      this.translateOverLifetime = {
        path: path && createValueGetter(path),
        x: createValueGetter(linearX),
        y: createValueGetter(linearY),
        z: createValueGetter(linearZ),
      };
    }

    if (model.rotationOverLifetime) {
      const { separateAxes, x = 0, y = 0, z = 0 } = model.rotationOverLifetime;

      this.rotationOverLifetime = {
        separateAxes,
        x: createValueGetter(x),
        y: createValueGetter(y),
        z: createValueGetter(z),
      };
    }
  }

  update (lifetime: number) {
    const quat: vec4 = [0, 0, 0, 1], position: vec3 = [0, 0, 0], rotation: vec3 = [0, 0, 0];

    vecAssign(position, this.options.position, 3);
    vecAssign(rotation, this.options.rotation, 3);
    const translateOverLifetime = this.translateOverLifetime;
    const rotationOverLifetime = this.rotationOverLifetime;

    lifetime = clamp(lifetime, 0, 1);

    if (translateOverLifetime) {
      position[0] += translateOverLifetime.x.getValue(lifetime);
      position[1] += translateOverLifetime.y.getValue(lifetime);
      position[2] += translateOverLifetime.z.getValue(lifetime);
      if (translateOverLifetime.path) {
        vecAdd(position, position, translateOverLifetime.path.getValue(lifetime));
      }
    }
    if (rotationOverLifetime) {
      const z = rotationOverLifetime.z.getValue(lifetime);

      rotation[2] += z;
      if (rotationOverLifetime.separateAxes) {
        rotation[0] += rotationOverLifetime.x.getValue(lifetime);
        rotation[1] += rotationOverLifetime.y.getValue(lifetime);
      } else {
        rotation[0] += z;
        rotation[1] += z;
      }
    }
    this.far = this.options.far.getValue(lifetime);
    this.near = this.options.near.getValue(lifetime);
    this.fov = this.options.fov.getValue(lifetime);

    this.transform.setPosition(position[0], position[1], position[2]);
    this.transform.setRotation(rotation[0], rotation[1], rotation[2]);
    this.transform.assignWorldTRS(position, quat);
    this.position = position;
    this.rotation = Transform.getRotation(rotation, quat);
  }

}
