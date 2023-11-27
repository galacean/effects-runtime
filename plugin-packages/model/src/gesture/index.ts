import type { Composition, CameraOptionsEx, spec } from '@galacean/effects';
import { Transform } from '@galacean/effects';
import type {
  CameraGestureHandler,
  CameraKeyEvent,
  CameraGestureHandlerParams,
} from './protocol';
import { CameraGestureType } from './protocol';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import { PCoordinate, PTransform } from '../runtime/common';
import { Quaternion, Vector3, Matrix4 } from '../runtime/math';

export class CameraGestureHandlerImp implements CameraGestureHandler {
  private cameraTransform = new PTransform();
  private cameraCoordiante = new PCoordinate();

  private startParams: CameraGestureHandlerParams = {
    type: CameraGestureType.none,
    mouseEvent: false,
    clientX: 0,
    clientY: 0,
    clientWidth: 512,
    clientHeight: 512,
    target: '',
  };

  constructor (
    private composition: Composition,
  ) { }

  getItem (): ModelVFXItem | undefined {
    return this.composition.items?.find(item => item.id === this.getCurrentTarget()) as ModelVFXItem;
  }

  getCurrentTarget (): string {
    return this.startParams.target;
  }

  getCurrentType (): CameraGestureType {
    return this.startParams.type;
  }

  onKeyEvent (event: CameraKeyEvent): CameraOptionsEx {
    // check event camera ID at first
    if (this.startParams.target !== event.cameraID) {
      this.startParams.target = event.cameraID;
      this.startParams.type = CameraGestureType.translate;
    }

    // can't find camera item, throw error message
    const item = this.getItem();

    if (item === undefined) {
      console.warn(`can't find camera item ${this.startParams.target}`);

      return this.composition.camera.getOptions();
    }

    const camera = this.composition.camera;
    const effectsTransfrom = new Transform({
      ...camera.getOptions(),
      valid: true,
    });
    const cameraTransform = new PTransform().fromEffectsTransform(effectsTransfrom);
    const cameraCoordiante = new PCoordinate().fromPTransform(cameraTransform);

    // compute move direction
    const xAxis = event.xAxis ?? 0;
    const yAxis = event.yAxis ?? 0;
    const zAxis = event.zAxis ?? 0;
    const dir = cameraCoordiante.xAxis.clone().multiply(xAxis);

    dir.add(cameraCoordiante.yAxis.clone().multiply(yAxis));
    dir.add(cameraCoordiante.zAxis.clone().multiply(zAxis));
    if (dir.lengthSquared() < 0.00001) {
      return camera.getOptions();
    }
    dir.normalize();

    // update camera position
    const speed = event.speed ?? 0.1;
    const pos = cameraTransform.getPosition();

    pos.add(dir.clone().multiply(speed));
    item.transform.setPosition(pos.x, pos.y, pos.z);
    item.updateTransform();

    // update camera transform and coordinates
    if (this.startParams.type === CameraGestureType.rotate_self) {
      this.cameraTransform.setPosition(pos);
      this.cameraCoordiante.origin = pos;
    }

    return camera.getOptions();
  }

  onXYMoveBegin (x: number, y: number, width: number, height: number, cameraID: string): CameraOptionsEx {
    const args = {
      type: CameraGestureType.translate,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: width,
      clientHeight: height,
      target: cameraID,
    };

    return this.startGesture(args);
  }

  onXYMoving (x: number, y: number, speed?: number): CameraOptionsEx {
    if (!this.startParams.mouseEvent) {
      return this.composition.camera.getOptions();
    }

    const arg0 = this.startParams;
    const arg = {
      type: CameraGestureType.translate,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: arg0.clientWidth,
      clientHeight: arg0.clientHeight,
      target: arg0.target,
      speed: speed ?? 0.015,
    };

    return this.moveGesture(arg);
  }

  onXYMoveEnd () {
    this.endGesture();
  }

  onZMoveBegin (x: number, y: number, width: number, height: number, cameraID: string): CameraOptionsEx {
    const arg = {
      type: CameraGestureType.scale,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: width,
      clientHeight: height,
      target: cameraID,
    };

    return this.startGesture(arg);
  }

  onZMoving (x: number, y: number, speed: number): CameraOptionsEx {
    if (!this.startParams.mouseEvent) {
      return this.composition.camera.getOptions();
    }

    const arg0 = this.startParams;
    const arg = {
      type: CameraGestureType.scale,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: arg0.clientWidth,
      clientHeight: arg0.clientHeight,
      target: arg0.target,
      speed: speed ?? 0.015,
    };

    return this.moveGesture(arg);
  }

  onZMoveEnd () {
    this.endGesture();
  }

  onRotateBegin (x: number, y: number, width: number, height: number, cameraID: string): CameraOptionsEx {
    const arg = {
      type: CameraGestureType.rotate_self,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: width,
      clientHeight: height,
      target: cameraID,
    };

    return this.startGesture(arg);
  }

  onRotating (x: number, y: number, speed?: number): CameraOptionsEx {
    if (!this.startParams.mouseEvent) {
      return this.composition.camera.getOptions();
    }

    const arg0 = this.startParams;
    const arg = {
      type: CameraGestureType.rotate_self,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: arg0.clientWidth,
      clientHeight: arg0.clientHeight,
      target: arg0.target,
      speed: speed ?? 1.5,
    };

    return this.moveGesture(arg);
  }

  onRotateEnd () {
    this.endGesture();
  }

  onRotatePointBegin (x: number, y: number, width: number, height: number, point: spec.vec3, cameraID: string): CameraOptionsEx {
    const arg = {
      type: CameraGestureType.rotate_focus,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: width,
      clientHeight: height,
      focusPoint: point,
      target: cameraID,
    };

    return this.startGesture(arg);
  }

  onRotatingPoint (x: number, y: number, speed?: number): CameraOptionsEx {
    if (!this.startParams.mouseEvent) {
      return this.composition.camera.getOptions();
    }

    const arg0 = this.startParams;
    const arg = {
      type: CameraGestureType.rotate_focus,
      mouseEvent: true,
      clientX: x,
      clientY: y,
      clientWidth: arg0.clientWidth,
      clientHeight: arg0.clientHeight,
      focusPoint: arg0.focusPoint,
      target: arg0.target,
      speed: speed ?? 8.0,
    };

    return this.moveGesture(arg);
  }

  onRotatePointEnd (): void {
    this.endGesture();
  }

  moveTo (cameraID: string, position: spec.vec3): void {
    this.startParams.target = cameraID;
    this.startParams.type = CameraGestureType.none;
    const item = this.getItem();

    if (item === undefined) {
      console.warn('can\'t find camera item');

      return;
    }
    item.transform.setPosition(...position);
    item.updateTransform();
  }

  rotateTo (cameraID: string, quat: spec.vec4): void {
    this.startParams.target = cameraID;
    this.startParams.type = CameraGestureType.none;
    const item = this.getItem();

    if (item === undefined) {
      console.warn('can\'t find camera item');

      return;
    }
    item.transform.setQuaternion(...quat);
    item.updateTransform();
  }

  onFocusPoint (cameraID: string, point: spec.vec3, distance?: number): void {
    this.startParams.target = cameraID;
    this.startParams.type = CameraGestureType.none;

    const item = this.getItem();

    if (item === undefined) {
      console.warn('can\'t find camera item');

      return;
    }
    const newDistance = distance ?? 5;
    const targetPoint = Vector3.fromArray(point);
    //
    const transform = new PTransform().fromEffectsTransform(item.transform);
    const coordinate = new PCoordinate().fromPTransform(transform);
    // FIXME: MATH
    const lookatDir = Vector3.fromArray(coordinate.zAxis.toArray()).multiply(1.0);
    //
    const newOffset = lookatDir.clone().multiply(newDistance);
    const newPosition = targetPoint.clone().add(newOffset);

    //
    item.transform.setPosition(newPosition.x, newPosition.y, newPosition.z);
    //
    // z+方向优先
    // const cameraPos = Vector3.fromArray(item.transform.position);
    // const newLookatDir = targetPoint.clone().subVector(cameraPos).normalize();
    // const newOffset = newLookatDir.clone().multiplyScalar(newDistance);
    // const newPosition = targetPoint.clone().subVector(newOffset);
    // const newUpVector = Vector3.tryZUpVector(newLookatDir, new Vector3);
    // const viewMatrix = Matrix4.computeLookAt(newPosition, targetPoint, newUpVector, new Matrix4);
    // const tranform = new PTransform().fromMatrix4(viewMatrix);
    // const newRotation = tranform.rotation;
    // item.transform.setQuat(-newRotation.x, -newRotation.y, -newRotation.z, newRotation.w);
    // item.transform.setPosition(newPosition.x, newPosition.y, newPosition.z);
    //
    // 旋转优先
    // const cameraPos = Vector3.fromArray(item.transform.position);
    // const newLookatDir = targetPoint.clone().subVector(cameraPos).normalize();
    // const newOffset = newLookatDir.clone().multiplyScalar(newDistance);
    // const newPosition = targetPoint.clone().subVector(newOffset);
    // const oldTransform = new PTransform().fromEffectsTransform(item.transform);
    // const oldCoordinate = new PCoordinate().fromPTransform(oldTransform)
    // const oldLookatDir = oldCoordinate.zAxis.clone().multiplyScalar(-1.0);
    // const rotateAxis = oldLookatDir.cross(newLookatDir);
    // const sinTheta = rotateAxis.length();
    // const theta = Math.asin(sinTheta);
    // const deltaRotation = Quaternion.fromAxisAngle(rotateAxis, theta, new Quaternion);
    // const newRotation = Quaternion.multiply(deltaRotation, oldTransform.rotation, new Quaternion);
    // item.transform.setQuat(newRotation.x, newRotation.y, newRotation.z, newRotation.w);
    // item.transform.setPosition(newPosition.x, newPosition.y, newPosition.z);
    //
    //
    item.updateTransform();
    this.startParams.target = '';
  }

  getCameraTransform (): Transform {
    const camera = this.composition.camera;
    const transform = new Transform(camera.getOptions());

    transform.setValid(true);

    return transform;
  }

  // TODO: 是否有用
  private initKeyEvent (cameraID: string, speed?: number) {
    this.startParams.target = cameraID;
    this.startParams.speed = speed;
    this.startParams.type = CameraGestureType.translate;
    this.updateCameraTransform(this.composition.camera.getOptions());
  }

  private startGesture (args: CameraGestureHandlerParams): CameraOptionsEx {
    this.startParams = args;
    this.updateCameraTransform(this.composition.camera.getOptions());

    if (!this.getItem()) {
      console.warn('invalid target');
    }

    return this.composition.camera.getOptions();
  }

  private moveGesture (arg: CameraGestureHandlerParams): CameraOptionsEx {
    if (this.getCurrentType() === arg.type) {
      const item = this.getItem();

      if (item === undefined) {
        console.warn('can\'t find camera item');

        return this.composition.camera.getOptions();
      }
      const speed = arg.speed ?? 1.015;
      const xAxis = this.cameraCoordiante.xAxis;
      const yAxis = this.cameraCoordiante.yAxis;
      const zAxis = this.cameraCoordiante.zAxis;
      const dx = (arg.clientX - this.startParams.clientX);
      const dy = (arg.clientY - this.startParams.clientY);

      if (arg.type === CameraGestureType.translate) {
        const pos = this.cameraTransform.getPosition();
        const newPos = pos.clone();

        newPos.add(xAxis.clone().multiply(-dx * speed));
        newPos.add(yAxis.clone().multiply(dy * speed));
        item.transform.setPosition(newPos.x, newPos.y, newPos.z);
        item.setTransform(item.transform.position, item.transform.rotation);
      } else if (arg.type === CameraGestureType.scale) {
        const pos = this.cameraTransform.getPosition();
        const newPos = pos.clone();

        newPos.add(zAxis.clone().multiply(dy * speed));
        item.transform.setPosition(newPos.x, newPos.y, newPos.z);
        item.setTransform(item.transform.position, item.transform.rotation);
      } else if (arg.type === CameraGestureType.rotate_self) {
        const ndx = dx / arg.clientWidth;
        const ndy = dy / arg.clientHeight;
        const dxAngle = ndx * Math.PI * speed * 0.5;
        const dyAngle = ndy * Math.PI * speed * 0.5;

        const newRotation = Quaternion.fromAxisAngle(Vector3.Y, -dxAngle);
        // FIXME: MATH
        const tempRotation = Quaternion.fromAxisAngle(xAxis, -dyAngle);

        newRotation.multiply(tempRotation);
        // FIXME: MATH
        newRotation.multiply(this.cameraTransform.getRotation());
        item.transform.setQuaternion(newRotation.x, newRotation.y, newRotation.z, newRotation.w);
        item.setTransform(item.transform.position, item.transform.rotation);
      } else if (arg.type === CameraGestureType.rotate_focus) {
        const ndx = dx / arg.clientWidth;
        const ndy = dy / arg.clientHeight;
        const dxAngle = ndx * Math.PI * speed;
        const dyAngle = ndy * Math.PI * speed;
        const newRotation = Quaternion.fromAxisAngle(Vector3.Y, -dxAngle);
        const tempRotation = Quaternion.fromAxisAngle(xAxis, -dyAngle);

        newRotation.multiply(tempRotation);
        const rotateMatrix = newRotation.toMatrix4(new Matrix4());
        const targetPoint = Vector3.fromArray(arg.focusPoint as spec.vec3);
        const deltaPosition = this.cameraCoordiante.origin.clone().subtract(targetPoint);

        rotateMatrix.transformPoint(deltaPosition);
        const newPosition = deltaPosition.add(targetPoint);

        newRotation.multiply(this.cameraTransform.getRotation());
        item.transform.setPosition(newPosition.x, newPosition.y, newPosition.z);
        item.transform.setQuaternion(newRotation.x, newRotation.y, newRotation.z, newRotation.w);
        item.setTransform(newPosition, item.transform.rotation);
      } else {
        console.warn('not implement');
      }
    } else {
      console.warn('invalid move type');
    }

    return this.composition.camera.getOptions();
  }

  private endGesture () {
    this.startParams.type = CameraGestureType.none;
    this.startParams.mouseEvent = false;
    this.startParams.target = '';
  }

  private updateCameraTransform (cameraOptions: CameraOptionsEx) {
    const effectsTransfrom = new Transform(cameraOptions);

    effectsTransfrom.setValid(true);

    this.cameraTransform.fromEffectsTransform(effectsTransfrom);
    this.cameraCoordiante.fromPTransform(this.cameraTransform);
  }
}

export * from './protocol';
