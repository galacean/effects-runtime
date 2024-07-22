import type { Camera } from '@galacean/effects';
import { math } from '@galacean/effects';
import { ImGui } from '../imgui';
const { Vector2, Vector3, Matrix4, Quaternion } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;

export class OrbitController {
  focusPosition: Vector3;
  targetPosition: Vector3 | undefined; // focus 时相机移动的目标位置
  originPostion: Vector3; // focus 时相机的原始位置
  t: number; // 相机 focus 插值系数
  camera: Camera;
  deltaTheta: number;
  deltaPhi: number;

  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;

  canvasWidth: number;
  canvasHeight: number;

  constructor () {
    this.focusPosition = new Vector3(0, 0, 0);
    this.deltaTheta = 0;
    this.deltaPhi = 0;
    this.t = 0;

    this.xAxis = new Vector3();
    this.yAxis = new Vector3();
    this.zAxis = new Vector3();
  }

  update (camera: Camera, canvasWidth: number, canvasHeight: number) {
    this.camera = camera;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    if (ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      this.handleRotate();
    }
    if (ImGui.IsMouseDown(ImGui.MouseButton.Middle)) {
      this.handlePan();
    }
    if (ImGui.GetIO().MouseWheelH !== 0) {
      this.handleZoom();
    }

    // 触发相机聚焦物体
    // if (this.input.getKeyDown(KeyCode.F)) {
    //   if (treeGui.activeItem) {
    //     const offset = this.camera.position.clone().subtract(this.focusPosition).normalize();
    //     const focusObjectScale = treeGui.activeItem.transform.scale;
    //     const scaleFactor = 3 * Math.max(1, Math.abs(focusObjectScale.x), Math.abs(focusObjectScale.y), Math.abs(focusObjectScale.z));

    //     this.focusPosition = treeGui.activeItem.transform.position.clone();
    //     this.targetPosition = offset.scale(scaleFactor).add(this.focusPosition);
    //     this.originPostion = this.camera.position.clone();
    //   }
    // }

    // 处理相机聚焦物体位移
    if (this.targetPosition) {
      const moveSpeed = 0.04;

      this.t += moveSpeed;

      this.camera.position = this.targetPosition.clone().scale(this.t).add(this.originPostion.clone().scale(1 - this.t));
      if (this.t >= 1) {
        this.camera.position = this.targetPosition.clone();
        this.targetPosition = undefined;
        this.t = 0;
      }
    }
  }

  handlePan () {
    const offset = this.camera.position.clone().subtract(this.focusPosition);

    const cameraHeight = this.camera.near * (Math.tan(this.camera.fov / 2 * Math.PI / 180)) * 2;
    const perPixelDistance = cameraHeight / this.canvasHeight;
    const moveSpeed = perPixelDistance * (offset.length() + this.camera.near) / this.camera.near;

    const dx = - ImGui.GetIO().MouseDelta.x * moveSpeed;
    const dy = + ImGui.GetIO().MouseDelta.y * moveSpeed;

    const cameraRight = Vector3.X.clone().applyMatrix(this.camera.getQuat().toMatrix4(new Matrix4()));
    const cameraUp = Vector3.Y.clone().applyMatrix(this.camera.getQuat().toMatrix4(new Matrix4()));
    const moveVector = cameraRight.clone().scale(dx).add(cameraUp.clone().scale(dy));

    this.camera.position = this.camera.position.add(moveVector);
    this.focusPosition.add(moveVector);
  }

  handleRotate () {
    const rotation = this.camera.getQuat().toMatrix4(new Matrix4()).toArray();

    this.xAxis.set(rotation[0], rotation[1], rotation[2]);

    const rotateSpeed = 1;
    const ndx = ImGui.GetIO().MouseDelta.x / 512;
    const ndy = ImGui.GetIO().MouseDelta.y / 1024;
    const dxAngle = ndx * Math.PI * rotateSpeed;
    const dyAngle = ndy * Math.PI * rotateSpeed;
    const newRotation = Quaternion.fromAxisAngle(Vector3.Y, -dxAngle);
    const tempRotation = Quaternion.fromAxisAngle(this.xAxis.normalize(), -dyAngle);

    newRotation.multiply(tempRotation);
    const rotateMatrix = newRotation.toMatrix4(new Matrix4());
    const targetPoint = this.focusPosition;
    const deltaPosition = this.camera.position.clone().subtract(targetPoint);

    rotateMatrix.transformPoint(deltaPosition);
    const newPosition = deltaPosition.add(targetPoint);

    newRotation.multiply(this.camera.getQuat());
    this.camera.position = new Vector3(newPosition.x, newPosition.y, newPosition.z);
    this.camera.setQuat(new Quaternion(newRotation.x, newRotation.y, newRotation.z, newRotation.w));
  }

  handleZoom () {
    const zoomSpeed = 0.05;
    const dy = ImGui.GetIO().MouseWheel * zoomSpeed;
    const offset = this.camera.position.clone().subtract(this.focusPosition);

    this.camera.position = this.focusPosition.clone().add(offset.scale(1 - dy));
  }
}