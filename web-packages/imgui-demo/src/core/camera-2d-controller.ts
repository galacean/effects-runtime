import type { Camera } from '@galacean/effects';
import { math } from '@galacean/effects';
import { ImGui } from '../imgui';

const { Vector3, Matrix4 } = math;

type Vector3 = math.Vector3;

/**
 * 2D 相机控制器
 */
export class Camera2DController {
  camera: Camera;
  canvasWidth: number;
  canvasHeight: number;

  // 2D 视图的中心点和缩放级别
  viewCenter: Vector3;
  zoomLevel: number; // 缩放级别，值越大越放大

  constructor () {
    this.viewCenter = new Vector3(0, 0, 0);
    this.zoomLevel = 1.0;
  }

  update (camera: Camera, canvasWidth: number, canvasHeight: number) {
    this.camera = camera;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // 空格 + 左键拖拽 或 中键拖拽：平移视图
    const isSpacePressed = ImGui.GetIO().KeyShift; // 使用 Shift 键代替空格键

    if ((ImGui.IsMouseDown(ImGui.MouseButton.Left) && isSpacePressed) ||
        ImGui.IsMouseDown(ImGui.MouseButton.Middle)) {
      this.handlePan();
    }

    // 鼠标滚轮：缩放
    if (ImGui.GetIO().MouseWheel !== 0) {
      this.handleZoom();
    }

    // 更新相机位置和方向
    this.updateCameraTransform();
  }

  /**
   * 处理 2D 平移
   */
  handlePan () {
    const dx = ImGui.GetIO().MouseDelta.x;
    const dy = ImGui.GetIO().MouseDelta.y;

    // 根据当前缩放级别调整移动速度
    const moveSpeed = 0.01 / this.zoomLevel;

    // 在 2D 平面上移动视图中心
    this.viewCenter.x -= dx * moveSpeed;
    this.viewCenter.y += dy * moveSpeed; // Y 轴方向相反
  }

  /**
   * 处理 2D 缩放
   */
  handleZoom () {
    const mouseWheel = ImGui.GetIO().MouseWheel;
    const zoomSpeed = 0.1;

    // 计算鼠标在画布上的位置
    const mousePos = ImGui.GetMousePos();
    const itemMin = ImGui.GetItemRectMin();
    const itemSize = ImGui.GetItemRectSize();

    // 归一化鼠标位置 (-1 到 1)
    const normalizedX = ((mousePos.x - itemMin.x) / itemSize.x) * 2 - 1;
    const normalizedY = (1 - (mousePos.y - itemMin.y) / itemSize.y) * 2 - 1;

    // 计算鼠标在世界空间中的位置（缩放前）
    const worldMouseX = this.viewCenter.x + normalizedX * (1 / this.zoomLevel);
    const worldMouseY = this.viewCenter.y + normalizedY * (1 / this.zoomLevel);

    // 更新缩放级别
    const oldZoomLevel = this.zoomLevel;

    this.zoomLevel *= (1 + mouseWheel * zoomSpeed);
    this.zoomLevel = Math.max(0.1, Math.min(10, this.zoomLevel)); // 限制缩放范围

    // 计算鼠标在世界空间中的位置（缩放后）
    const newWorldMouseX = this.viewCenter.x + normalizedX * (1 / this.zoomLevel);
    const newWorldMouseY = this.viewCenter.y + normalizedY * (1 / this.zoomLevel);

    // 调整视图中心，使鼠标指向的点保持不变
    this.viewCenter.x += (worldMouseX - newWorldMouseX);
    this.viewCenter.y += (worldMouseY - newWorldMouseY);
  }

  /**
   * 更新相机的变换矩阵，将其设置为正交 2D 视图
   */
  updateCameraTransform () {
    // 将相机移动到视图中心的正上方
    const cameraDistance = 10; // 相机距离 2D 平面的距离

    this.camera.position = new Vector3(
      this.viewCenter.x,
      this.viewCenter.y,
      cameraDistance
    );

    // 设置相机朝向 -Z 方向（俯视 2D 平面）
    this.camera.rotation = new math.Euler(0, 0, 0);

    // 调整相机的 FOV 或正交大小来实现缩放效果
    // 这里通过调整相机位置的 Z 值来模拟缩放
    const baseDistance = 10;
    const position = this.camera.position;

    position.z = baseDistance / this.zoomLevel;
    this.camera.position = position;
  }

  /**
   * 重置视图到初始状态
   */
  reset () {
    this.viewCenter = new Vector3(0, 0, 0);
    this.zoomLevel = 1.0;
  }
}
