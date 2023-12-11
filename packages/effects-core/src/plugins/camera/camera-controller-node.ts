import type * as spec from '@galacean/effects-specification';
import { clamp, Euler, Quaternion, Vector3 } from '@galacean/effects-math/es/core/index';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { Transform } from '../../transform';

export class CameraController {
  near: number;
  far: number;
  fov: number;
  clipMode?: spec.CameraClipMode;
  position: Vector3;
  rotation: Euler;

  private options: {
    position: Vector3,
    rotation: Euler,
    near: ValueGetter<number>,
    far: ValueGetter<number>,
    fov: ValueGetter<number>,
  };
  private readonly translateOverLifetime?: {
    path?: ValueGetter<spec.vec3>,
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
    const { position } = transform;
    const rotation = transform.getRotation();
    const { near, far, fov, clipMode } = model.options;

    this.clipMode = clipMode;
    this.options = {
      position: position.clone(),
      rotation: rotation.clone(),
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
    const quat = new Quaternion();
    const position = new Vector3();
    const rotation = new Euler();

    position.copyFrom(this.options.position);
    rotation.copyFrom(this.options.rotation);
    const translateOverLifetime = this.translateOverLifetime;
    const rotationOverLifetime = this.rotationOverLifetime;

    lifetime = clamp(lifetime, 0, 1);

    if (translateOverLifetime) {
      position.x += translateOverLifetime.x.getValue(lifetime);
      position.y += translateOverLifetime.y.getValue(lifetime);
      position.z += translateOverLifetime.z.getValue(lifetime);
      if (translateOverLifetime.path) {
        const val = translateOverLifetime.path.getValue(lifetime);

        position.x += val[0];
        position.y += val[1];
        position.z += val[2];
      }
    }
    if (rotationOverLifetime) {
      const z = rotationOverLifetime.z.getValue(lifetime);

      rotation.z += z;
      if (rotationOverLifetime.separateAxes) {
        rotation.x += rotationOverLifetime.x.getValue(lifetime);
        rotation.y += rotationOverLifetime.y.getValue(lifetime);
      } else {
        rotation.x += z;
        rotation.y += z;
      }
    }
    this.far = this.options.far.getValue(lifetime);
    this.near = this.options.near.getValue(lifetime);
    this.fov = this.options.fov.getValue(lifetime);

    this.transform.setPosition(position.x, position.y, position.z);
    this.transform.setRotation(rotation.x, rotation.y, rotation.z);
    this.transform.assignWorldTRS(position, quat);
    this.position = position;
    this.rotation = Transform.getRotation(quat, rotation);
  }

}
