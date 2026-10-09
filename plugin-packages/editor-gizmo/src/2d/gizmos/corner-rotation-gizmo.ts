import {
  MouseButton,
  MouseButtonMask,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import { GestureCursorType, type GestureCursorResult } from '../cursor';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { GizmoType } from '../gizmo-type';
import { decomposeItemTransform } from '../items';
import { DEG2RAD, RAD2DEG, Vector2, Vector3, getAngleByVectors, getTransformedBoxCorners, getVector2Angle } from '../math';
import { roundNumber } from '@galacean/effects-math/es/extension/index';
import type {
  ResizeSelectionGizmo } from './resize-selection-gizmo';
import {
  SCALE_CORNER_HIT_SIZE,
  TransformType,
} from './resize-selection-gizmo';

/** 角旋转命中结果。 */
type RotationHit = {
  /** 命中角点相对选框中心的方向。 */
  direction: Vector2,
};

/** Shift 旋转吸附的角度步长。 */
const SHIFT_ROTATION_STEP_DEGREES = 15;

/** 通过选框角点命中区域旋转选中对象。 */
export class CornerRotationGizmo extends Gizmo {
  readonly type: GizmoType = GizmoType.CORNER_ROTATION;

  cursorResult: GestureCursorResult = {
    type: GestureCursorType.NORMAL,
    angle: 0,
  };

  /** 当前指针的视图坐标；拖拽期间按 Control 本地坐标增量推进。 */
  cursorPoint: Vector2 = new Vector2();

  /** 上一帧指针的 Control 本地坐标。 */
  lastPoint: Vector2 = new Vector2();

  /** 单次旋转会话累计的 z 轴角度，用于保持旋转光标朝向连续。 */
  rotationAngle = 0;

  private rotationActive = false;
  private anchor = new Vector2();
  private interactiveDirection = new Vector2();
  /** 未吸附的累计拖拽角，独立于已应用角度，避免逐帧取整丢失小幅移动。 */
  private rawRotationAngle = 0;
  /** pointer down 时选区节点的公共世界角度，用于吸附最终朝向而非单次拖拽增量。 */
  private initialSelectionAngle = 0;
  /** pointer down 时冻结的旋转对象，避免拖拽中途换目标。 */
  private rotationItems: VFXItem[] = [];

  /**
   * 创建共享选框几何的角旋转交互。
   * @param owner Gizmo 宿主。
   * @param resizeSelection 提供选框几何的缩放 Gizmo。
   */
  constructor (
    owner: GizmoOwner,
    private readonly resizeSelection: ResizeSelectionGizmo,
  ) {
    super(owner);
  }

  /** 当前选中的对象。 */
  get selectedItems (): VFXItem[] {
    return this._owner.getSelection().getSelectedPlayerItems();
  }

  /**
   * 更新角旋转悬停或正在进行的旋转。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.rotationActive) {
      const handled = this.updateRotationDrag(event);

      this._owner.setCursor(this.cursorResult);
      if (handled) {
        event.accept();
      }

      return;
    }

    if (!this.isApplicableSelection()) {
      this.clearHover();

      return;
    }

    const hit = this.refreshHover(this._owner.getMousePosition());

    if (event.buttonMask === MouseButtonMask.None && hit) {
      event.accept();
    }
  }

  /**
   * 继续当前角旋转交互。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.rotationActive) {
      return;
    }
    const handled = this.updateRotationDrag(event);

    this._owner.setCursor(this.cursorResult);
    if (handled) {
      event.accept();
    }
  }

  /**
   * 在角旋转命中区域按下主键时开始旋转。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.isApplicableSelection() || event.buttonIndex !== MouseButton.Left || event.doubleClick) {
      return;
    }

    this.resizeSelection.refreshWireframeBySelectedItems();
    const point = new Vector2(event.position.x, event.position.y);
    const hit = this.refreshHover(point);

    if (!hit) {
      return;
    }

    this.cursorPoint.copyFrom(point);
    this.lastPoint.copyFrom(event.position);
    this.rotationAngle = 0;
    this.rawRotationAngle = 0;
    this.anchor.copyFrom(this.resizeSelection.wireframe.anchor);
    this.interactiveDirection.copyFrom(hit.direction);
    // Selection 保证父子节点不会同时入选，交互层直接冻结权威选区。
    this.rotationItems = [...this.selectedItems];
    this.initialSelectionAngle = this.resolveInitialSelectionAngle();
    this.rotationActive = true;
    this._owner.emit('actionstart', {
      source: this,
      transformType: TransformType.ROTATION,
      itemIds: this.rotationItems.map(item => item.getInstanceId()),
    });
    event.accept();
  }

  /**
   * 结束旋转并提交结果。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.rotationActive) {
      return;
    }

    const currentPoint = new Vector2(event.position.x, event.position.y);

    this.cursorPoint.add(new Vector2().subtractVectors(currentPoint, this.lastPoint));
    this.resetOperation();
    this._owner.emit('actioncommit', {
      source: this,
      transformType: TransformType.ROTATION,
    });

    this.resizeSelection.refreshWireframeBySelectedItems();
    this.refreshHover(this._owner.getMousePosition());
    event.accept();
  }

  /** 清除离开视口后的旋转悬停状态。 */
  override onMouseLeave (): void {
    if (this.rotationActive) {
      this._owner.setCursor(this.cursorResult);

      return;
    }
    this.clearHover();
  }

  /** @returns 当前选区是否支持旋转。 */
  private isApplicableSelection (): boolean {
    const selectedItems = this.selectedItems;
    const loadingManager = this._owner.getLoadingManager();

    return selectedItems.length >= 1
      && selectedItems.every(item => loadingManager.get(item.getInstanceId()) === undefined);
  }

  /**
   * 根据指针增量更新累计旋转角度。
   * @param event 鼠标拖拽事件。
   * @returns 是否处理了旋转。
   */
  private updateRotationDrag (event: InputEventMouseMotion): boolean {
    if (!this.rotationActive) {
      return false;
    }

    const currentPoint = new Vector2(event.position.x, event.position.y);
    const shift = new Vector2().subtractVectors(currentPoint, this.lastPoint);

    // 键盘事件会在捕获期间重放当前位置的 Drag；即使指针位移为 0，也要重新应用当前约束。
    if (!this.resizeSelection.wireframe.interactive) {
      return true;
    }

    if (shift.length() > 0) {
      this._owner.setSelectionTransformKind('resize');
      const vecStart = new Vector2().subtractVectors(this.cursorPoint, this.anchor);

      this.cursorPoint.add(shift);
      const vecCurrent = new Vector2().subtractVectors(this.cursorPoint, this.anchor);
      const angle = getAngleByVectors(vecStart, vecCurrent) * RAD2DEG;

      if (Number.isFinite(angle)) {
        this.rawRotationAngle += angle;
      }
      this.lastPoint.copyFrom(currentPoint);
    }

    this.applyRotation(event);

    return true;
  }

  /**
   * 应用累计旋转角，并在 Shift 按下时吸附角度。
   * @param event 鼠标拖拽事件。
   */
  private applyRotation (event: InputEventMouseMotion): void {
    const targetAngle = roundNumber(
      event.shiftPressed
        ? Math.round(
          (this.initialSelectionAngle + this.rawRotationAngle)
          / SHIFT_ROTATION_STEP_DEGREES,
        ) * SHIFT_ROTATION_STEP_DEGREES - this.initialSelectionAngle
        : this.rawRotationAngle,
      3,
    );
    const angle = roundNumber(targetAngle - this.rotationAngle, 3);

    this.setRotationCursor(
      getVector2Angle(this.interactiveDirection) + targetAngle * DEG2RAD,
    );
    if (angle === 0) {
      return;
    }

    this._owner.setSelectionTransformKind('resize');
    const rotation = new Vector3(0, 0, angle);

    this.rotationItems.forEach(item => {
      item.rotate(...rotation.toArray());
    });
    this.rotationAngle = targetAngle;
    this._owner.emit('actionupdate', {
      source: this,
      transformType: TransformType.ROTATION,
    });
  }

  /** 重置旋转交互状态。 */
  private resetOperation (): void {
    if (this._owner.getSelectionTransformKind() === 'resize') {
      this._owner.setSelectionTransformKind('idle');
    }
    this.rotationActive = false;
    this.rotationAngle = 0;
    this.lastPoint.set(0, 0);
    this.cursorPoint.set(0, 0);
    this.anchor.set(0, 0);
    this.interactiveDirection.set(0, 0);
    this.rawRotationAngle = 0;
    this.initialSelectionAngle = 0;
    this.rotationItems = [];
  }

  /**
   * 查找指针命中的角旋转区域。
   * @param point 指针视口坐标。
   * @returns 角旋转命中结果。
   */
  private findRotationHit (point: Vector2): RotationHit | undefined {
    // 步骤 1：校验选框是否可交互且指针位于总命中区域内。
    const { wireframe } = this.resizeSelection;

    if (
      !wireframe.interactive
      || !wireframe.totalBox.containsPoint(point)
      || !wireframe.scaleCorners.length
    ) {
      return undefined;
    }

    // 步骤 2：建立选框局部坐标轴和命中尺寸。
    const { xAxis, yAxis } = this.boxLocalAxes();
    const boxCenter = wireframe.box.getCenter();
    const rotationHalfSize = this.resizeSelection.config.rotationCircleSize;
    const scaleHalfSize = SCALE_CORNER_HIT_SIZE / 2;

    // 步骤 3：逐角点排除缩放区并检测外侧旋转区。
    for (const corner of wireframe.scaleCorners) {
      const cornerOffset = new Vector2().subtractVectors(point, corner.center);
      const insideScaleCorner = Math.abs(cornerOffset.dot(xAxis)) <= scaleHalfSize
        && Math.abs(cornerOffset.dot(yAxis)) <= scaleHalfSize;

      if (insideScaleCorner) {
        continue;
      }

      const direction = new Vector2().subtractVectors(corner.center, boxCenter);
      const xSign = direction.dot(xAxis) >= 0 ? 1 : -1;
      const ySign = direction.dot(yAxis) >= 0 ? 1 : -1;
      const hitCenter = corner.center.clone()
        .add(xAxis.clone().multiply(xSign * rotationHalfSize))
        .add(yAxis.clone().multiply(ySign * rotationHalfSize));
      const hitOffset = new Vector2().subtractVectors(point, hitCenter);

      if (
        Math.abs(hitOffset.dot(xAxis)) <= rotationHalfSize
        && Math.abs(hitOffset.dot(yAxis)) <= rotationHalfSize
      ) {
        return { direction };
      }
    }

    return undefined;
  }

  /** @returns 选框在视口中的局部坐标轴。 */
  private boxLocalAxes (): { xAxis: Vector2, yAxis: Vector2 } {
    const transform = this.resizeSelection.wireframe.transform;
    const points = transform ? getTransformedBoxCorners(transform) : undefined;

    if (!points?.length) {
      return { xAxis: new Vector2(1, 0), yAxis: new Vector2(0, 1) };
    }
    const xVector = new Vector2().subtractVectors(points[1], points[0]);
    const yVector = new Vector2().subtractVectors(points[3], points[0]);

    return {
      xAxis: xVector.length() > 0 ? xVector.normalize() : new Vector2(1, 0),
      yAxis: yVector.length() > 0 ? yVector.normalize() : new Vector2(0, 1),
    };
  }

  /**
   * 获取 Shift 吸附使用的初始绝对角度。
   * 角度来自节点变换，不从选框或子元素包围盒反推；
   * 多选节点没有公共角度时使用 0°。
   * @returns 当前选区在视图平面内的初始角度（度）。
   */
  private resolveInitialSelectionAngle (): number {
    if (this.rotationItems.length === 0) {
      return 0;
    }

    const angles = this.rotationItems.map(item => (
      roundNumber(decomposeItemTransform(item).rotation.z, 3)
    ));
    const sharedAngle = angles[0];

    return Number.isFinite(sharedAngle) && angles.every(angle => angle === sharedAngle)
      ? sharedAngle
      : 0;
  }

  /**
   * 刷新指定位置的旋转悬停状态。
   * @param point 指针视口坐标。
   * @returns 角旋转命中结果。
   */
  private refreshHover (point: Vector2): RotationHit | undefined {
    const hit = this.findRotationHit(point);

    if (!hit) {
      this.clearHover();

      return undefined;
    }

    this.interactiveDirection.copyFrom(hit.direction);
    this.setRotationCursor(getVector2Angle(hit.direction));

    return hit;
  }

  /**
   * 更新旋转光标。
   * @param angle 旋转方向的弧度值。
   */
  private setRotationCursor (angle: number): void {
    this.cursorResult = {
      type: GestureCursorType.ROTATION,
      angle: (angle + Math.PI / 4) * RAD2DEG,
    };
    this._owner.setCursor(this.cursorResult);
  }

  /** 清除旋转悬停状态。 */
  private clearHover (): void {
    this.interactiveDirection.set(0, 0);
    this.cursorResult = {
      type: GestureCursorType.NORMAL,
      angle: 0,
    };
    this._owner.setCursor(this.cursorResult);
  }
}
