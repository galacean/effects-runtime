import type { Camera } from '@galacean/effects';
import { math } from '@galacean/effects';
import type { Input } from './input';
const { Vector2, Vector3, Matrix4, Quaternion } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;

export class OrbitController {
  targetPosition: Vector3;
  camera: Camera;
  deltaTheta: number;
  deltaPhi: number;
  input: Input;

  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;

  constructor (camera: Camera, input: Input) {
    this.setup(camera, input);
  }

  setup (camera: Camera, input: Input) {
    this.targetPosition = new Vector3(0, 0, 0);
    this.camera = camera;
    this.deltaTheta = 0;
    this.deltaPhi = 0;

    this.xAxis = new Vector3();
    this.yAxis = new Vector3();
    this.zAxis = new Vector3();

    this.input = input;
  }

  update () {
    if (this.input.getMouseButton(0)) {
      this.handleRotate();
    }
    if (this.input.getMouseButton(1)) {
      this.handlePan();
    }
    if (this.input.mouseWheelDeltaY !== 0) {
      this.handleZoom();
    }
  }

  handlePan () {
    const offset = this.camera.position.clone().subtract(this.targetPosition);

    const cameraHeight = this.camera.near * (Math.tan(this.camera.fov / 2 * Math.PI / 180)) * 2;
    const perPixelDistance = cameraHeight / this.input.canvas.clientHeight;
    const moveSpeed = perPixelDistance * (offset.length() + this.camera.near) / this.camera.near;

    const dx = - this.input.mouseMovement.x * moveSpeed;
    const dy = + this.input.mouseMovement.y * moveSpeed;

    const cameraRight = Vector3.X.clone().applyMatrix(this.camera.getQuat().toMatrix4(new Matrix4()));
    const cameraUp = Vector3.Y.clone().applyMatrix(this.camera.getQuat().toMatrix4(new Matrix4()));
    const moveVector = cameraRight.clone().scale(dx).add(cameraUp.clone().scale(dy));

    this.camera.position = this.camera.position.add(moveVector);
    this.targetPosition.add(moveVector);
  }

  handleRotate () {
    const rotation = this.camera.getQuat().toMatrix4(new Matrix4()).toArray();

    this.xAxis.set(rotation[0], rotation[1], rotation[2]);

    const rotateSpeed = 1;
    const ndx = this.input.mouseMovement.x / 512;
    const ndy = this.input.mouseMovement.y / 1024;
    const dxAngle = ndx * Math.PI * rotateSpeed;
    const dyAngle = ndy * Math.PI * rotateSpeed;
    const newRotation = Quaternion.fromAxisAngle(Vector3.Y, -dxAngle);
    const tempRotation = Quaternion.fromAxisAngle(this.xAxis.normalize(), -dyAngle);

    newRotation.multiply(tempRotation);
    const rotateMatrix = newRotation.toMatrix4(new Matrix4());
    const targetPoint = this.targetPosition;
    const deltaPosition = this.camera.position.clone().subtract(targetPoint);

    rotateMatrix.transformPoint(deltaPosition);
    const newPosition = deltaPosition.add(targetPoint);

    newRotation.multiply(this.camera.getQuat());
    this.camera.position = new Vector3(newPosition.x, newPosition.y, newPosition.z);
    this.camera.setQuat(new Quaternion(newRotation.x, newRotation.y, newRotation.z, newRotation.w));
  }

  handleZoom () {
    const zoomSpeed = 0.0005;
    const dy = -this.input.mouseWheelDeltaY * zoomSpeed;

    this.camera.position = this.camera.position.scale(1 - dy);
  }
}