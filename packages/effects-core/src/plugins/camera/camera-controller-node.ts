import { clamp, Euler, Quaternion, Vector3 } from '@galacean/effects-math/es/core/index';
import type * as spec from '@galacean/effects-specification';
import { ItemBehaviour } from '../../components';
import type { Engine } from '../../engine';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { Transform } from '../../transform';
import { effectsClass } from '../../decorators';
import { DataType } from '../../asset-loader';

@effectsClass(DataType.CameraController)
export class CameraController extends ItemBehaviour {
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
  private translateOverLifetime?: {
    path?: ValueGetter<spec.vec3>,
    x: ValueGetter<number>,
    y: ValueGetter<number>,
    z: ValueGetter<number>,
  };
  private rotationOverLifetime?: {
    separateAxes?: boolean,
    x: ValueGetter<number>,
    y: ValueGetter<number>,
    z: ValueGetter<number>,
    rotation?: ValueGetter<number>,
  };

  constructor (
    engine: Engine,
    props?: spec.CameraContent,
  ) {
    super(engine);

    if (props) {
      this.fromData(props);
    }
  }

  override start (): void {
    this.options.position = this.transform.position.clone();
    this.options.rotation = this.transform.getRotation().clone();
  }

  override update () {
    let lifetime = this.item.lifetime;

    if (lifetime < 0 || !this.item.transform.getValid()) {
      return;
    }
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

    this.updateCamera();
  }

  override fromData (data: spec.CameraContent): void {
    super.fromData(data);
    const { near, far, fov, clipMode } = data.options;

    this.clipMode = clipMode;
    this.options = {
      position: new Vector3(),
      rotation: new Euler(),
      near: createValueGetter(near),
      far: createValueGetter(far),
      fov: createValueGetter(fov),
    };
    if (data.positionOverLifetime) {
      const { path, linearX = 0, linearY = 0, linearZ = 0 } = data.positionOverLifetime;

      this.translateOverLifetime = {
        path: path && createValueGetter(path),
        x: createValueGetter(linearX),
        y: createValueGetter(linearY),
        z: createValueGetter(linearZ),
      };
    }

    if (data.rotationOverLifetime) {
      const { separateAxes, x = 0, y = 0, z = 0 } = data.rotationOverLifetime;

      this.rotationOverLifetime = {
        separateAxes,
        x: createValueGetter(x),
        y: createValueGetter(y),
        z: createValueGetter(z),
      };
    }
  }

  private updateCamera () {
    if (this.item.composition) {
      const camera = this.item.composition.camera;

      camera.near = this.near;
      camera.far = this.far;
      camera.fov = this.fov;
      camera.clipMode = this.clipMode;
      camera.position = this.position;
      camera.rotation = this.rotation;
    }
  }
}
