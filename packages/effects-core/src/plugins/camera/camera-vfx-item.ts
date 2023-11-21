import * as spec from '@galacean/effects-specification';
import { VFXItem } from '../../vfx-item';
import { CameraController } from './camera-controller-node';

export class CameraVFXItem extends VFXItem<CameraController> {
  private model: spec.CameraContent;
  private controller: CameraController;

  override get type (): spec.ItemType {
    return spec.ItemType.camera;
  }

  override onConstructed (props: spec.CameraItem) {
    this.model = props.content;
  }

  override onItemUpdate (dt: number, lifetime: number) {
    this.controller?.update(lifetime);
    this.updateCamera();
  }

  // override onEnd () {
  //   this.controller?.update(1);
  //   this.updateCamera();
  // }

  private updateCamera () {
    if (this.controller && this.composition) {
      const camera = this.composition.camera;

      camera.near = this.controller.near;
      camera.far = this.controller.far;
      camera.fov = this.controller.fov;
      camera.clipMode = this.controller.clipMode;
      camera.position = this.controller.position;
      camera.rotation = this.controller.rotation;
    }
  }

  override getCurrentPosition () {
    return this.controller.position;
  }

  protected override doCreateContent () {
    if (!this.controller) {
      this.controller = new CameraController(this.transform, this.model);
    }

    return this.controller;
  }
}
