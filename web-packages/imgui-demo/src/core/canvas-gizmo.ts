import type { Camera, Region, Renderer } from '@galacean/effects-core';
import { math, Render2D, RendererComponent, VFXItem } from '@galacean/effects-core';

const { Vector2, Vector3, Matrix4, Color, Quaternion } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;

// Transform gizmo control properties
enum GizmoMode {
  None = 0,
  Move = 1,
  Rotate = 2,
  Resize = 3,
}

enum HandleType {
  None = 0,
  Center = 1,        // 中心点，用于移动
  TopLeft = 2,       // 左上角缩放
  TopRight = 3,      // 右上角缩放
  BottomLeft = 4,    // 左下角缩放
  BottomRight = 5,   // 右下角缩放
  Top = 6,           // 上边缘缩放
  Bottom = 7,        // 下边缘缩放
  Left = 8,          // 左边缘缩放
  Right = 9,         // 右边缘缩放
  Rotation = 10,     // 旋转手柄
}

interface TransformStartData {
  position: Vector3,
  size: Vector2,
  rotation: number,
  mousePos: Vector2,
}

export class CanvasGizmo extends RendererComponent {
  selectedObjects: VFXItem[] = [];

  private render2D: Render2D;
  private canvas: HTMLCanvasElement;
  private hoveredObject: VFXItem | null = null;

  // 2D Camera control properties
  private viewCenter: Vector3 = new Vector3(0, 0, 0);
  private zoomLevel: number = 1.0;
  private isDragging: boolean = false;
  private lastMousePos: Vector2 = new Vector2(0, 0);

  private activeHandle: HandleType = HandleType.None;
  private gizmoMode: GizmoMode = GizmoMode.None;
  private transformStart: TransformStartData | null = null;

  private get activeObject (): VFXItem | null {
    return this.selectedObjects.length > 0 ? this.selectedObjects[0] : null;
  }

  override onAwake (): void {
    this.priority = 5000;
    this.canvas = this.engine.canvas;
    this.render2D = new Render2D(this.engine);

    // Setup mouse event listeners for 2D camera control
    this.setupMouseListeners();
  }

  reset2DCamera () {
    this.viewCenter = new Vector3(0, 0, 0);
    this.zoomLevel = 1.0;

    this.updateCameraTransform();
  }

  private setupMouseListeners (): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {

      // 检查是否点击了 gizmo 手柄
      let handle = this.getHandleAtPosition(e.clientX, e.clientY);

      if (handle === HandleType.None) {
        const pickedItems = this.pickItems(e.clientX, e.clientY);

        this.selectedObjects = [];
        if (pickedItems.length > 0) {
          this.selectedObjects = [pickedItems[pickedItems.length - 1]];
        }

        handle = this.getHandleAtPosition(e.clientX, e.clientY);
      }

      if (handle !== HandleType.None && this.activeObject instanceof VFXItem) {
      // 开始 gizmo 操作
        this.activeHandle = handle;
        this.startTransform(e);
        e.preventDefault();
      }

      // 记录鼠标按下位置，用于检测点击事件
      this.lastMousePos.set(e.clientX, e.clientY);
    }

    if (e.button === 1) { // Middle mouse button for panning
      this.isDragging = true;
      this.lastMousePos.set(e.clientX, e.clientY);
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    // 更新 gizmo 变换
    if (this.activeHandle !== HandleType.None) {
      this.updateTransform(e);

      return;
    }

    // 相机平移
    if (this.isDragging) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;

      // 根据当前缩放级别调整移动速度
      const moveSpeed = 0.01 / this.zoomLevel;

      // 在 2D 平面上移动视图中心
      this.viewCenter.x -= dx * moveSpeed;
      this.viewCenter.y += dy * moveSpeed; // Y 轴方向相反

      this.lastMousePos.set(e.clientX, e.clientY);
      this.updateCameraTransform();

      return;
    }

    const pickedItems = this.pickItems(e.clientX, e.clientY);

    this.hoveredObject = pickedItems[pickedItems.length - 1] || null;

    // 更新鼠标悬停时的光标
    const handle = this.getHandleAtPosition(e.clientX, e.clientY);

    this.updateCursor(handle, e);
  };

  private onMouseUp = (e: MouseEvent): void => {
    // 结束 gizmo 操作
    if (this.activeHandle !== HandleType.None) {
      this.activeHandle = HandleType.None;
      this.gizmoMode = GizmoMode.None;
      this.transformStart = null;

      return;
    }

    if (e.button === 1) {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
    }

    // 检测左键点击事件（鼠标按下和抬起位置相近）
    if (e.button === 0) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 如果移动距离小于 5 像素，视为点击
      if (distance < 5) {
        this.onClick(e.clientX, e.clientY, e);
      }
    }
  };

  // 鼠标点击事件回调
  private onClick (x: number, y: number, event: MouseEvent): void {

  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const mouseWheel = -e.deltaY / 100; // 标准化滚轮值
    const zoomSpeed = 0.1;

    // 计算鼠标在画布上的位置
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 归一化鼠标位置 (-1 到 1)
    const normalizedX = (mouseX / rect.width) * 2 - 1;
    const normalizedY = (1 - mouseY / rect.height) * 2 - 1;

    // 计算鼠标在世界空间中的位置（缩放前）
    const worldMouseX = this.viewCenter.x + normalizedX * (1 / this.zoomLevel);
    const worldMouseY = this.viewCenter.y + normalizedY * (1 / this.zoomLevel);

    // 更新缩放级别
    this.zoomLevel *= (1 + mouseWheel * zoomSpeed);
    this.zoomLevel = Math.max(0.1, Math.min(10, this.zoomLevel)); // 限制缩放范围

    // 计算鼠标在世界空间中的位置（缩放后）
    const newWorldMouseX = this.viewCenter.x + normalizedX * (1 / this.zoomLevel);
    const newWorldMouseY = this.viewCenter.y + normalizedY * (1 / this.zoomLevel);

    // 调整视图中心，使鼠标指向的点保持不变
    this.viewCenter.x += (worldMouseX - newWorldMouseX);
    this.viewCenter.y += (worldMouseY - newWorldMouseY);

    this.updateCameraTransform();
  };

  private updateCameraTransform (): void {
    const composition = this.item?.composition;

    if (composition?.camera) {
      const camera = composition.camera;
      const cameraDistance = 10; // 相机距离 2D 平面的距离

      // 将相机移动到视图中心的正上方
      camera.position = new Vector3(
        this.viewCenter.x,
        this.viewCenter.y,
        cameraDistance
      );

      // 设置相机朝向 -Z 方向（俯视 2D 平面）
      camera.rotation = new math.Euler(0, 0, 0);

      // 通过调整相机位置的 Z 值来实现缩放效果
      const baseDistance = 10;
      const position = camera.position;

      position.z = baseDistance / this.zoomLevel;
      camera.position = position;
    }
  }

  private pickItems (x: number, y: number): VFXItem[] {
    // 计算鼠标在画布上的位置
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = x - rect.left;
    const mouseY = y - rect.top;

    // 归一化鼠标位置 (-1 到 1)
    const normalizedX = (mouseX / rect.width) * 2 - 1;
    const normalizedY = (1 - mouseY / rect.height) * 2 - 1;

    const res = [];

    if (this.item.composition) {
      const hitResults = this.item.composition.hitTest(normalizedX, normalizedY, true);

      for (const hitResult of hitResults) {
        res.push(hitResult.item);
      }
    }

    return res;
  }

  // Transform Gizmo 相关方法
  private getHandleAtPosition (x: number, y: number): HandleType {
    if (!(this.activeObject instanceof VFXItem)) {
      return HandleType.None;
    }

    const mesh = this.activeObject.getComponent(RendererComponent);

    if (!(mesh instanceof RendererComponent)) {
      return HandleType.None;
    }

    // 将 client 坐标转换为 canvas 坐标系（左下角为原点）
    const rect = this.canvas.getBoundingClientRect();

    // 计算 canvas 实际分辨率和显示大小的比例
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    // 转换为 canvas 实际坐标（考虑缩放）
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (rect.height - (y - rect.top)) * scaleY; // 翻转 Y 轴并缩放

    const boundingBox = mesh.getBoundingBoxInfo().boundingBox;
    const screenPoints: Vector3[] = [];

    for (let i = 0; i < 4; i++) {
      screenPoints.push(mesh.item.composition!.camera.worldToScreenPoint(boundingBox.vectorsWorld[i]));
    }

    const handleSize = 20;
    const rotationHandleDistance = 40; // 旋转手柄距离边框的距离

    // 检查四个角的缩放手柄
    // screenPoints: [0]左下(x=200,y=587), [1]右上(x=877,y=1264), [2]右下(x=877,y=587), [3]左上(x=200,y=1264)
    const corners = [
      { point: screenPoints[3], type: HandleType.TopLeft },
      { point: screenPoints[1], type: HandleType.TopRight },
      { point: screenPoints[0], type: HandleType.BottomLeft },
      { point: screenPoints[2], type: HandleType.BottomRight },
    ];

    for (const corner of corners) {
      if (this.isPointInHandle(canvasX, canvasY, corner.point.x, corner.point.y, handleSize)) {
        return corner.type;
      }
    }

    // 检查边缘中点的缩放手柄
    const edges = [
      { point: this.midPoint(screenPoints[3], screenPoints[1]), type: HandleType.Top },
      { point: this.midPoint(screenPoints[0], screenPoints[2]), type: HandleType.Bottom },
      { point: this.midPoint(screenPoints[3], screenPoints[0]), type: HandleType.Left },
      { point: this.midPoint(screenPoints[1], screenPoints[2]), type: HandleType.Right },
    ];

    for (const edge of edges) {
      if (this.isPointInHandle(canvasX, canvasY, edge.point.x, edge.point.y, handleSize)) {
        return edge.type;
      }
    }

    // 检查旋转手柄（在顶部中点上方）
    const topMid = this.midPoint(screenPoints[3], screenPoints[1]);
    const rotationHandleY = topMid.y + rotationHandleDistance; // 注意：在左下角坐标系中，+y 是向上

    if (this.isPointInHandle(canvasX, canvasY, topMid.x, rotationHandleY, handleSize)) {
      return HandleType.Rotation;
    }

    // 检查中心点（用于移动）
    const center = new Vector2(
      (screenPoints[0].x + screenPoints[1].x + screenPoints[2].x + screenPoints[3].x) / 4,
      (screenPoints[0].y + screenPoints[1].y + screenPoints[2].y + screenPoints[3].y) / 4
    );

    // 检查是否在边框内
    // 重新排列点的顺序形成正确的多边形：左下 -> 右下 -> 右上 -> 左上
    // screenPoints: [0]左下, [1]右上, [2]右下, [3]左上
    const orderedPoints = [screenPoints[0], screenPoints[2], screenPoints[1], screenPoints[3]];

    if (this.isPointInBounds(canvasX, canvasY, orderedPoints)) {
      return HandleType.Center;
    }

    return HandleType.None;
  }

  private isPointInHandle (x: number, y: number, handleX: number, handleY: number, size: number): boolean {
    return Math.abs(x - handleX) <= size / 2 && Math.abs(y - handleY) <= size / 2;
  }

  private isPointInBounds (x: number, y: number, points: Vector3[]): boolean {
    // 使用光线投射法检测点是否在多边形内
    // 注意：points 已经是 canvas 坐标系（左下角为原点）
    let inside = false;
    const n = points.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;

      // 检查水平射线是否与边相交
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  private midPoint (p1: Vector3, p2: Vector3): Vector2 {
    return new Vector2((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  }

  private startTransform (e: MouseEvent): void {
    if (!(this.activeObject instanceof VFXItem)) {
      return;
    }

    const item = this.activeObject;

    this.transformStart = {
      position: item.transform.position.clone(),
      size: item.transform.size.clone(),
      rotation: item.transform.rotation.z,
      mousePos: new Vector2(e.clientX, e.clientY),
    };

    // 根据手柄类型设置 gizmo 模式
    if (this.activeHandle === HandleType.Center) {
      this.gizmoMode = GizmoMode.Move;
    } else if (this.activeHandle === HandleType.Rotation) {
      this.gizmoMode = GizmoMode.Rotate;
    } else {
      this.gizmoMode = GizmoMode.Resize;
    }
  }

  private updateTransform (e: MouseEvent): void {
    if (!this.transformStart || !(this.activeObject instanceof VFXItem)) {
      return;
    }

    const item = this.activeObject;
    const camera = item.composition!.camera;

    switch (this.gizmoMode) {
      case GizmoMode.Move:
        this.handleMove(e, item, camera);

        break;
      case GizmoMode.Rotate:
        this.handleRotate(e, item, camera);

        break;
      case GizmoMode.Resize:
        this.handleScale(e, item, camera);

        break;
    }
  }

  private handleMove (e: MouseEvent, item: VFXItem, camera: Camera): void {
    if (!this.transformStart) {return;}

    // 计算屏幕空间移动（CSS 像素）
    const screenDx = e.clientX - this.transformStart.mousePos.x;
    const screenDy = e.clientY - this.transformStart.mousePos.y;

    // 获取 canvas 分辨率缩放比例
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    // 转换为 canvas 像素空间（与 worldToScreenPoint 一致）
    const canvasDx = screenDx * scaleX;
    const canvasDy = -screenDy * scaleY; // Y 轴翻转（屏幕向下是正，世界向上是正）

    // 将屏幕空间的移动转换为世界空间
    const worldDelta = this.screenToWorld(canvasDx, canvasDy, camera);

    const newPosition = this.transformStart.position.clone();

    newPosition.x += worldDelta.x;
    newPosition.y += worldDelta.y;

    item.transform.setPosition(newPosition.x, newPosition.y, newPosition.z);
  }

  private handleRotate (e: MouseEvent, item: VFXItem, camera: Camera): void {
    if (!this.transformStart) {return;}

    const mesh = item.getComponent(RendererComponent);

    if (!(mesh instanceof RendererComponent)) {return;}

    // 获取物体中心的屏幕坐标
    const boundingBox = mesh.getBoundingBoxInfo().boundingBox;
    const worldCenter = new Vector3(
      (boundingBox.vectorsWorld[0].x + boundingBox.vectorsWorld[1].x + boundingBox.vectorsWorld[2].x + boundingBox.vectorsWorld[3].x) / 4,
      (boundingBox.vectorsWorld[0].y + boundingBox.vectorsWorld[1].y + boundingBox.vectorsWorld[2].y + boundingBox.vectorsWorld[3].y) / 4,
      (boundingBox.vectorsWorld[0].z + boundingBox.vectorsWorld[1].z + boundingBox.vectorsWorld[2].z + boundingBox.vectorsWorld[3].z) / 4
    );
    const screenCenter = camera.worldToScreenPoint(worldCenter);

    // 将 client 坐标转换为 canvas 坐标系（左下角为原点）
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const currentCanvasX = (e.clientX - rect.left) * scaleX;
    const currentCanvasY = (rect.height - (e.clientY - rect.top)) * scaleY;

    // 计算当前鼠标相对于物体中心的角度
    const currentAngle = Math.atan2(
      currentCanvasY - screenCenter.y,
      currentCanvasX - screenCenter.x
    );

    // 计算起始时鼠标相对于物体中心的角度
    const startCanvasX = (this.transformStart.mousePos.x - rect.left) * scaleX;
    const startCanvasY = (rect.height - (this.transformStart.mousePos.y - rect.top)) * scaleY;
    const startAngle = Math.atan2(
      startCanvasY - screenCenter.y,
      startCanvasX - screenCenter.x
    );

    // 计算旋转增量（弧度）
    const deltaAngle = currentAngle - startAngle;

    // 将弧度转换为角度
    const deltaAngleDegrees = deltaAngle * 180 / Math.PI;

    // 应用旋转：初始旋转 + 增量（注意方向）
    const newRotation = this.transformStart.rotation - deltaAngleDegrees;

    item.transform.setRotation(0, 0, newRotation);
  }

  private handleScale (e: MouseEvent, item: VFXItem, camera: Camera): void {
    if (!this.transformStart) {return;}

    // 计算屏幕空间移动（CSS 像素）
    const screenDx = e.clientX - this.transformStart.mousePos.x;
    const screenDy = e.clientY - this.transformStart.mousePos.y;

    // 获取 canvas 分辨率缩放比例
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    // 转换为 canvas 像素空间（与 worldToScreenPoint 一致）
    const canvasDx = screenDx * scaleX;
    const canvasDy = -screenDy * scaleY; // Y 轴翻转（屏幕向下是正，世界向上是正）

    // 根据相机 Z 位置计算世界空间每像素的比例
    const res = calculateWorldPerPixelPerspective(camera.getProjectionMatrix().elements, this.canvas.width, this.canvas.height, camera.position.z);

    const worldDx = canvasDx * res * 2;
    const worldDy = canvasDy * res * 2;

    // 将世界坐标的增量转换为 local 坐标系
    // 获取物体当前的旋转角度（弧度）
    const rotationRad = -item.transform.rotation.z * Math.PI / 180;

    // 应用反向旋转矩阵
    const localDx = worldDx * Math.cos(-rotationRad) - worldDy * Math.sin(-rotationRad);
    const localDy = worldDx * Math.sin(-rotationRad) + worldDy * Math.cos(-rotationRad);

    let newWidth = this.transformStart.size.x;
    let newHeight = this.transformStart.size.y;

    switch (this.activeHandle) {
      case HandleType.TopLeft:
        newWidth = this.transformStart.size.x - localDx;
        newHeight = this.transformStart.size.y + localDy;

        break;
      case HandleType.TopRight:
        newWidth = this.transformStart.size.x + localDx;
        newHeight = this.transformStart.size.y + localDy;

        break;
      case HandleType.BottomLeft:
        newWidth = this.transformStart.size.x - localDx;
        newHeight = this.transformStart.size.y - localDy;

        break;
      case HandleType.BottomRight:
        newWidth = this.transformStart.size.x + localDx;
        newHeight = this.transformStart.size.y - localDy;

        break;
      case HandleType.Top:
        newHeight = this.transformStart.size.y + localDy;

        break;
      case HandleType.Bottom:
        newHeight = this.transformStart.size.y - localDy;

        break;
      case HandleType.Left:
        newWidth = this.transformStart.size.x - localDx;

        break;
      case HandleType.Right:
        newWidth = this.transformStart.size.x + localDx;

        break;
    }

    item.transform.setSize(newWidth, newHeight);
  }

  private screenToWorld (dx: number, dy: number, camera: Camera): Vector2 {
    // 根据相机 Z 位置计算世界空间每像素的比例
    const WorldPerPixel = calculateWorldPerPixelPerspective(camera.getProjectionMatrix().elements, this.canvas.width, this.canvas.height, camera.position.z);

    return new Vector2(dx * WorldPerPixel, dy * WorldPerPixel);
  }

  private updateCursor (handle: HandleType, e: MouseEvent): void {
    const item = this.activeObject;

    if (!item) {
      return;
    }

    let cursorStyle = 'default';
    const rotation = -item.transform.rotation.z;

    switch (handle) {
      case HandleType.TopLeft:
        cursorStyle = ResizeCursorManager.getCursor(-rotation + 45);

        break;
      case HandleType.BottomRight:
        cursorStyle = ResizeCursorManager.getCursor(-rotation + 45);

        break;
      case HandleType.TopRight:
        cursorStyle = ResizeCursorManager.getCursor(-rotation - 45);

        break;
      case HandleType.BottomLeft:
        cursorStyle = ResizeCursorManager.getCursor(-rotation - 45);

        break;
      case HandleType.Top:
        cursorStyle = ResizeCursorManager.getCursor(-rotation + 90);

        break;
      case HandleType.Bottom:
        cursorStyle = ResizeCursorManager.getCursor(-rotation + 90);

        break;
      case HandleType.Left:
        cursorStyle = ResizeCursorManager.getCursor(-rotation);

        break;
      case HandleType.Right:
        cursorStyle = ResizeCursorManager.getCursor(-rotation);

        break;
      case HandleType.Center:
        cursorStyle = 'default';

        break;
      case HandleType.Rotation:
        cursorStyle = 'crosshair';

        break;
      case HandleType.None:
        cursorStyle = 'default';

        break;
    }

    this.canvas.style.cursor = cursorStyle || 'default';
  }

  override onDestroy (): void {
    // Clean up event listeners
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  override render (renderer: Renderer): void {
    this.render2D.begin();
    const lineColor = new math.Color(0.2, 0.4, 1, 1);
    const lineWidth = 3;

    if (this.gizmoMode !== GizmoMode.Move) {
      if (this.hoveredObject) {
        const rendererComponent = this.hoveredObject.getComponent(RendererComponent);

        if (rendererComponent) {
          const boundingBox = rendererComponent.getBoundingBoxInfo().boundingBox;
          const screenPoints: math.Vector3[] = [];

          for (let i = 0; i < 4; i++) {
            screenPoints.push(rendererComponent.item.composition!.camera.worldToScreenPoint(boundingBox.vectorsWorld[i]));
          }

          const linePoints = [];

          linePoints.push(screenPoints[0].toVector2(), screenPoints[2].toVector2(), screenPoints[1].toVector2(), screenPoints[3].toVector2());
          linePoints.push(linePoints[0].clone());
          this.render2D.drawLines(linePoints, lineColor, lineWidth + 2);
        }
      }

      if (this.selectedObjects.length > 0) {
        const selectedItem = this.selectedObjects[0];
        const rendererComponent = selectedItem.getComponent(RendererComponent);

        if (rendererComponent) {
          const boundingBox = rendererComponent.getBoundingBoxInfo().boundingBox;
          const screenPoints: math.Vector3[] = [];

          for (let i = 0; i < 4; i++) {
            screenPoints.push(rendererComponent.item.composition!.camera.worldToScreenPoint(boundingBox.vectorsWorld[i]));
          }

          const linePoints = [];

          linePoints.push(screenPoints[0].toVector2(), screenPoints[2].toVector2(), screenPoints[1].toVector2(), screenPoints[3].toVector2());
          linePoints.push(linePoints[0].clone());
          this.render2D.drawLines(linePoints, lineColor, lineWidth);

          const resizeHandleSize = 20;
          const fillSize = resizeHandleSize - lineWidth;
          const rotationHandleDistance = 40;

          // 绘制四个角的缩放手柄
          for (const screenPoint of screenPoints) {
            this.render2D.drawRectangle(screenPoint.x - resizeHandleSize / 2, screenPoint.y - resizeHandleSize / 2, resizeHandleSize, resizeHandleSize, lineColor, lineWidth);
            this.render2D.fillRectangle(screenPoint.x - fillSize / 2, screenPoint.y - fillSize / 2, fillSize, fillSize, new Color(1, 1, 1, 1));
          }

          // 绘制边缘中点的缩放手柄
          const edges = [
            this.midPoint(screenPoints[3], screenPoints[1]), // Top
            this.midPoint(screenPoints[0], screenPoints[2]), // Bottom
            this.midPoint(screenPoints[3], screenPoints[0]), // Left
            this.midPoint(screenPoints[1], screenPoints[2]), // Right
          ];

          for (const edgePoint of edges) {
            this.render2D.drawRectangle(edgePoint.x - resizeHandleSize / 2, edgePoint.y - resizeHandleSize / 2, resizeHandleSize, resizeHandleSize, lineColor, lineWidth);
            this.render2D.fillRectangle(edgePoint.x - fillSize / 2, edgePoint.y - fillSize / 2, fillSize, fillSize, new Color(1, 1, 1, 1));
          }

          // 绘制旋转手柄（顶部中点上方）
          const topMid = this.midPoint(screenPoints[3], screenPoints[1]);
          const rotationHandleY = topMid.y + rotationHandleDistance; // 在左下角坐标系中，+y 是向上

          // 绘制连接线
          this.render2D.drawLine(new Vector2(topMid.x, topMid.y), new Vector2(topMid.x, rotationHandleY), lineColor, 2);

          // 绘制旋转手柄（圆形）
          const rotationHandleRadius = 8;

          this.render2D.drawRectangle(
            topMid.x - rotationHandleRadius,
            rotationHandleY - rotationHandleRadius,
            rotationHandleRadius * 2,
            rotationHandleRadius * 2,
            new Color(0.2, 1, 0.4, 1),
            lineWidth
          );
          this.render2D.fillRectangle(
            topMid.x - rotationHandleRadius + lineWidth,
            rotationHandleY - rotationHandleRadius + lineWidth,
            rotationHandleRadius * 2 - lineWidth * 2,
            rotationHandleRadius * 2 - lineWidth * 2,
            new Color(0.6, 1, 0.8, 1)
          );
        }
      }
    }

    // this.render2D.pushTransform(new Matrix3().rotate(45 / 180 * Math.PI));
    // this.render2D.pushTransform(new Matrix3().scale(2, 2));
    // this.render2D.pushTransform(new Matrix3().translate(500, 500));

    // 测试形状绘制
    //-------------------------------------------------------------------------

    // 绘制两条交叉的线
    this.render2D.drawLine(new Vector2(20, 20), new Vector2(170, 120), new Color(0.8, 0.2, 0.2, 1), 4);
    this.render2D.drawLine(new Vector2(20, 120), new Vector2(170, 20), new Color(0.2, 0.2, 0.8, 1), 4);

    // 绘制填充矩形
    this.render2D.fillRectangle(20, 150, 150, 100, new Color(0.2, 0.8, 0.2, 1));

    // 绘制描边矩形
    this.render2D.drawRectangle(20, 280, 150, 100, new Color(0.8, 0.6, 0.2, 1), 6);

    // 绘制贝塞尔曲线 - 明显的弯曲效果
    this.render2D.drawBezier(
      new Vector2(20, 410),      // 起点（左下）
      new Vector2(95, 410),      // 控制点1（中间偏上）
      new Vector2(95, 510),      // 控制点2（中间偏下）
      new Vector2(170, 510),     // 终点（右下）
      new Color(0.8, 0.2, 0.8, 1),
      4
    );
    this.render2D.end();
  }
}

/**
 * 计算透视投影的 WorldPerPixel
 * @param projectionMatrix 投影矩阵（4x4 列主序数组）
 * @param viewportWidth 视口宽度（像素）
 * @param viewportHeight 视口高度（像素）
 * @param depth 测量深度（世界空间单位）
 * @returns world/pixel
 */
function calculateWorldPerPixelPerspective (
  projectionMatrix: Float32Array | number[],
  viewportWidth: number,
  viewportHeight: number,
  depth: number
): number {
  const m = projectionMatrix;

  // 提取投影矩阵参数（列主序）
  // m[0] = 1 / (aspect * tan(fov_y / 2))
  // m[5] = 1 / tan(fov_y / 2)
  const m00 = m[0];
  const m11 = m[5];

  // === 垂直方向 ===
  const tanHalfFovY = 1.0 / m11;
  const frustumHeight = 2.0 * depth * tanHalfFovY;
  const verticalWPP = frustumHeight / viewportHeight;

  // === 水平方向 ===
  const tanHalfFovX = 1.0 / m00;
  const frustumWidth = 2.0 * depth * tanHalfFovX;
  const horizontalWPP = frustumWidth / viewportWidth;

  return horizontalWPP;
}

/**
 * Resize Cursor 管理器，生成和缓存自定义 resize cursor
 */
class ResizeCursorManager {
  private static cache = new Map<string, string>();
  private static readonly DEFAULT_SIZE = 24;
  private static readonly DEFAULT_COLOR = '#000000';

  /**
   * 生成 resize cursor
   */
  static getCursor (
    angle: number,
    size: number = 25,
    primaryColor: string = '#000000',
    outlineColor: string = '#FFFFFF'
  ): string {
    angle = ((angle % 360) + 360) % 360;
    const key = `${angle.toFixed(1)}_${size}_${primaryColor}_${outlineColor}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const cursor = this.generateCursor(angle, size, primaryColor, outlineColor);

    this.cache.set(key, cursor);

    return cursor;
  }

  /**
   * 应用 cursor 到元素
   */
  static apply (
    element: HTMLElement,
    angle: number,
    size?: number,
    color?: string
  ): void {
    try {
      const cursor = this.getCursor(angle, size, color);

      element.style.cursor = cursor;
    } catch (error) {
      console.error('Failed to apply resize cursor:', error);
      // 降级到标准 cursor
      this.applyFallbackCursor(element, angle);
    }
  }

  /**
   * 清除缓存
   */
  static clearCache (): void {
    this.cache.clear();
  }

  /**
   * 生成 SVG
   */
  private static generateCursor (
    angle: number,
    size: number,
    primaryColor: string = '#000000',
    outlineColor: string = '#FFFFFF'
  ): string {
    const rad = angle * Math.PI / 180;
    const center = size / 2;

    // 方向向量
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const perpX = -dy;
    const perpY = dx;

    // ===== 风格的尺寸参数 =====
    const lineLength = size * 0.42;        // 线段长度（从中心到端点）
    const strokeWidth = 1.5;               // 细线条
    const outlineWidth = 3;                // 白色描边宽度

    // 箭头参数（更小更精致）
    const arrowLength = size * 0.16;       // 箭头长度
    const arrowWidth = size * 0.15;        // 箭头宽度（更窄）

    // 线段端点
    const x1 = center - dx * lineLength;
    const y1 = center - dy * lineLength;
    const x2 = center + dx * lineLength;
    const y2 = center + dy * lineLength;

    // ===== 箭头 1（正方向）=====
    const arrow1 = {
      tip: { x: x2, y: y2 },
      base1: {
        x: x2 - dx * arrowLength + perpX * arrowWidth,
        y: y2 - dy * arrowLength + perpY * arrowWidth,
      },
      base2: {
        x: x2 - dx * arrowLength - perpX * arrowWidth,
        y: y2 - dy * arrowLength - perpY * arrowWidth,
      },
    };

    // ===== 箭头 2（负方向）=====
    const arrow2 = {
      tip: { x: x1, y: y1 },
      base1: {
        x: x1 + dx * arrowLength + perpX * arrowWidth,
        y: y1 + dy * arrowLength + perpY * arrowWidth,
      },
      base2: {
        x: x1 + dx * arrowLength - perpX * arrowWidth,
        y: y1 + dy * arrowLength - perpY * arrowWidth,
      },
    };

    // ===== 构建 SVG =====
    const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +

            // 白色描边层（绘制两次：先粗白线，后细黑线）
            '<g>' +
                // 主线 - 白色描边
                '<line ' +
                'x1="' + x1.toFixed(2) + '" ' +
                'y1="' + y1.toFixed(2) + '" ' +
                'x2="' + x2.toFixed(2) + '" ' +
                'y2="' + y2.toFixed(2) + '" ' +
                'stroke="' + outlineColor + '" ' +
                'stroke-width="' + outlineWidth + '" ' +
                'stroke-linecap="round"/>' +

                // 箭头 1 - 白色描边
                '<path d="' +
                'M' + arrow1.tip.x.toFixed(2) + ',' + arrow1.tip.y.toFixed(2) + ' ' +
                'L' + arrow1.base1.x.toFixed(2) + ',' + arrow1.base1.y.toFixed(2) + ' ' +
                'L' + arrow1.base2.x.toFixed(2) + ',' + arrow1.base2.y.toFixed(2) + ' Z" ' +
                'fill="' + outlineColor + '" ' +
                'stroke="' + outlineColor + '" ' +
                'stroke-width="' + (outlineWidth - strokeWidth) + '" ' +
                'stroke-linejoin="round"/>' +

                // 箭头 2 - 白色描边
                '<path d="' +
                'M' + arrow2.tip.x.toFixed(2) + ',' + arrow2.tip.y.toFixed(2) + ' ' +
                'L' + arrow2.base1.x.toFixed(2) + ',' + arrow2.base1.y.toFixed(2) + ' ' +
                'L' + arrow2.base2.x.toFixed(2) + ',' + arrow2.base2.y.toFixed(2) + ' Z" ' +
                'fill="' + outlineColor + '" ' +
                'stroke="' + outlineColor + '" ' +
                'stroke-width="' + (outlineWidth - strokeWidth) + '" ' +
                'stroke-linejoin="round"/>' +
            '</g>' +

            // 主体层（黑色）
            '<g>' +
                // 主线 - 黑色
                '<line ' +
                'x1="' + x1.toFixed(2) + '" ' +
                'y1="' + y1.toFixed(2) + '" ' +
                'x2="' + x2.toFixed(2) + '" ' +
                'y2="' + y2.toFixed(2) + '" ' +
                'stroke="' + primaryColor + '" ' +
                'stroke-width="' + strokeWidth + '" ' +
                'stroke-linecap="round"/>' +

                // 箭头 1 - 黑色
                '<path d="' +
                'M' + arrow1.tip.x.toFixed(2) + ',' + arrow1.tip.y.toFixed(2) + ' ' +
                'L' + arrow1.base1.x.toFixed(2) + ',' + arrow1.base1.y.toFixed(2) + ' ' +
                'L' + arrow1.base2.x.toFixed(2) + ',' + arrow1.base2.y.toFixed(2) + ' Z" ' +
                'fill="' + primaryColor + '"/>' +

                // 箭头 2 - 黑色
                '<path d="' +
                'M' + arrow2.tip.x.toFixed(2) + ',' + arrow2.tip.y.toFixed(2) + ' ' +
                'L' + arrow2.base1.x.toFixed(2) + ',' + arrow2.base1.y.toFixed(2) + ' ' +
                'L' + arrow2.base2.x.toFixed(2) + ',' + arrow2.base2.y.toFixed(2) + ' Z" ' +
                'fill="' + primaryColor + '"/>' +
            '</g>' +

            '</svg>';

    const svgEncoded = encodeURIComponent(svg);

    return 'url("data:image/svg+xml,' + svgEncoded + '") ' + center + ' ' + center + ', auto';
  }

  /**
   * 降级到标准 CSS cursor
   */
  private static applyFallbackCursor (element: HTMLElement, angle: number): void {
    // 规范化角度
    angle = ((angle % 360) + 360) % 360;

    // 映射到最接近的标准 cursor
    if (angle >= 337.5 || angle < 22.5) {
      element.style.cursor = 'ew-resize';        // → 0°
    } else if (angle >= 22.5 && angle < 67.5) {
      element.style.cursor = 'nesw-resize';      // ↗ 45°
    } else if (angle >= 67.5 && angle < 112.5) {
      element.style.cursor = 'ns-resize';        // ↑ 90°
    } else if (angle >= 112.5 && angle < 157.5) {
      element.style.cursor = 'nwse-resize';      // ↖ 135°
    } else if (angle >= 157.5 && angle < 202.5) {
      element.style.cursor = 'ew-resize';        // ← 180°
    } else if (angle >= 202.5 && angle < 247.5) {
      element.style.cursor = 'nesw-resize';      // ↙ 225°
    } else if (angle >= 247.5 && angle < 292.5) {
      element.style.cursor = 'ns-resize';        // ↓ 270°
    } else {
      element.style.cursor = 'nwse-resize';      // ↘ 315°
    }
  }

  /**
   * 移除 cursor
   */
  static remove (element: HTMLElement): void {
    element.style.cursor = '';
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats (): { size: number, keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
