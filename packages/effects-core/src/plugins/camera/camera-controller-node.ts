import * as spec from '@galacean/effects-specification';
import { Behaviour } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';

@effectsClass(spec.DataType.CameraController)
export class CameraController extends Behaviour {
  private options: CameraControllerOptions;

  constructor (
    engine: Engine,
    props?: spec.CameraContent,
  ) {
    super(engine);

    if (props) {
      this.fromData(props);
    }
  }

  override onUpdate () {
    if (this.item.composition && this.item.transform.getValid()) {
      const camera = this.item.composition.camera;

      camera.near = this.options.near;
      camera.far = this.options.far;
      camera.fov = this.options.fov;
      camera.clipMode = this.options.clipMode;

      camera.transform.parentTransform = this.transform.parentTransform;
      camera.position = this.transform.position;
      // TODO 修正 GE 四元数旋转共轭问题
      camera.setQuat(this.transform.getQuaternion().clone().conjugate());
    }
  }

  override fromData (data: spec.CameraContent): void {
    super.fromData(data);

    this.options = data.options;
  }
}

interface CameraControllerOptions {
  fov: number,
  far: number,
  near: number,
  clipMode?: spec.CameraClipMode,
  aspect?: number,
}
