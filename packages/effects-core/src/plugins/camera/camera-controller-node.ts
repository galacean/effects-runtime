import { Euler, Quaternion, Vector3 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { ItemBehaviour } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { Transform } from '../../transform';

@effectsClass(spec.DataType.CameraController)
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
    near: number,
    far: number,
    fov: number,
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
    if (!this.item.transform.getValid()) {
      return;
    }
    const quat = new Quaternion();
    const position = new Vector3();
    const rotation = new Euler();

    position.copyFrom(this.transform.position);
    rotation.copyFrom(this.transform.rotation);
    this.far = this.options.far;
    this.near = this.options.near;
    this.fov = this.options.fov;

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
      near: near,
      far: far,
      fov: fov,
    };
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
