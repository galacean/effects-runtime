import {
  InputEventMouseMotion,
  MouseButtonMask,
  type InputEventKey,
  type InputEventMouse,
  type InputEventMouseButton,
  type InputEventWithModifiers,
  type Engine,
} from '@galacean/effects';
import { Control, FocusMode, MouseFilter } from '@galacean/effects-plugin-gui';
import { isDragThresholdReached } from '../drag-threshold';
import { Vector2 } from '../math';

/** 拖拽距离阈值状态。 */
enum DragThresholdState {
  /** 未开始按键会话。 */
  Idle,
  /** 已按下但尚未越过阈值。 */
  Pending,
  /** 已越过拖拽阈值。 */
  Crossed,
}

/** 维护画布输入状态并将绘制和交互事件转发给 Gizmo 层。 */
export class GizmoViewport extends Control {
  /** 鼠标进入回调。 */
  onMouseEnterCallback: ((location: Vector2) => void) | null = null;
  /** 鼠标悬停移动回调。 */
  onMouseMoveCallback: ((event: InputEventMouseMotion) => void) | null = null;
  /** 鼠标拖拽回调。 */
  onMouseDragCallback: ((event: InputEventMouseMotion) => void) | null = null;
  /** 鼠标离开回调。 */
  onMouseLeaveCallback: (() => void) | null = null;
  /** 鼠标滚轮回调。 */
  onMouseWheelCallback: ((event: InputEventMouseButton) => void) | null = null;
  /** 鼠标按下回调。 */
  onMouseDownCallback: ((event: InputEventMouseButton) => void) | null = null;
  /** 鼠标抬起回调。 */
  onMouseUpCallback: ((event: InputEventMouseButton) => void) | null = null;
  /** 键盘按下回调。 */
  onKeyDownCallback: ((event: InputEventKey) => void) | null = null;
  /** 键盘抬起回调。 */
  onKeyUpCallback: ((event: InputEventKey) => void) | null = null;
  /** 每帧更新回调。 */
  onUpdateCallback: (() => void) | null = null;
  /** 绘制回调。 */
  drawCallBack: (() => void) | null = null;

  private readonly mousePosition = new Vector2();
  private readonly globalMousePosition = new Vector2();
  private readonly dragStart = new Vector2();
  private mouseInside = false;
  private mouseButtonMask = MouseButtonMask.None;
  private dragThresholdState = DragThresholdState.Idle;
  private shiftPressed = false;
  private altPressed = false;
  private metaPressed = false;
  private ctrlPressed = false;

  /**
   * @param engine Effects 引擎实例
   */
  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Pass;
    this.focusMode = FocusMode.Click;
    this.mouseForcePassScrollEvents = false;
    this.setAnchorsAndOffsetsPreset('fullRect');
  }

  /**
   * 在每帧更新时触发 Gizmo 更新回调。
   * @param _deltaTime 帧间隔
   */
  override update (_deltaTime: number): void {
    this.onUpdateCallback?.();
  }

  /** 触发 Gizmo 绘制回调。 */
  override draw (): void {
    this.drawCallBack?.();
  }

  /**
   * 记录鼠标进入位置并转发事件。
   * @param location 鼠标本地坐标
   */
  override onMouseEnter (location: Vector2): void {
    this.mouseInside = true;
    this.mousePosition.copyFrom(location);
    this.onMouseEnterCallback?.(location);
  }

  /**
   * 更新输入状态，并按按键状态分发移动或拖拽事件。
   * @param event 鼠标移动事件
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    this.recordMouseInput(event);
    const hasPressedButtons = event.buttonMask !== MouseButtonMask.None;

    if (
      hasPressedButtons
      && this.dragThresholdState === DragThresholdState.Pending
      && isDragThresholdReached(
        this.dragStart.x,
        this.dragStart.y,
        event.position.x,
        event.position.y,
      )
    ) {
      this.dragThresholdState = DragThresholdState.Crossed;
    }

    if (hasPressedButtons) {
      this.onMouseDragCallback?.(event);
    } else {
      this.onMouseMoveCallback?.(event);
    }
  }

  /** 记录鼠标离开并转发事件。 */
  override onMouseLeave (): void {
    this.mouseInside = false;
    this.onMouseLeaveCallback?.();
  }

  /**
   * 更新输入状态并转发滚轮事件。
   * @param event 鼠标滚轮事件
   */
  override onMouseWheel (event: InputEventMouseButton): void {
    this.recordMouseInput(event);
    this.onMouseWheelCallback?.(event);
  }

  /**
   * 开始按键会话并记录拖拽起点。
   * @param event 鼠标按下事件
   */
  override onMouseDown (event: InputEventMouseButton): void {
    this.recordMouseInput(event);
    this.dragStart.copyFrom(event.position);
    this.dragThresholdState = DragThresholdState.Pending;
    this.onMouseDownCallback?.(event);
  }

  /**
   * 结束按键会话并重置拖拽阈值。
   * @param event 鼠标抬起事件
   */
  override onMouseUp (event: InputEventMouseButton): void {
    this.recordMouseInput(event);
    this.dragThresholdState = DragThresholdState.Idle;
    this.onMouseUpCallback?.(event);
  }

  /**
   * 更新修饰键状态并转发键盘按下事件。
   * @param event 键盘按下事件
   */
  override onKeyDown (event: InputEventKey): void {
    this.recordModifiers(event);
    this.onKeyDownCallback?.(event);
  }

  /**
   * 更新修饰键状态并转发键盘抬起事件。
   * @param event 键盘抬起事件
   */
  override onKeyUp (event: InputEventKey): void {
    this.recordModifiers(event);
    this.onKeyUpCallback?.(event);
  }

  /** @returns 当前鼠标本地坐标。 */
  getMousePosition (): Vector2 {
    return this.mousePosition;
  }

  /** @returns 鼠标是否位于控件内。 */
  isMouseInside (): boolean {
    return this.mouseInside;
  }

  /** @returns 当前是否有鼠标按钮按下。 */
  isMouseButtonPressed (): boolean {
    return this.mouseButtonMask !== MouseButtonMask.None;
  }

  /** @returns 当前按键会话是否已越过拖拽阈值。 */
  hasCrossedDragThreshold (): boolean {
    return this.dragThresholdState === DragThresholdState.Crossed;
  }

  /** @returns 使用当前输入快照创建的鼠标移动事件。 */
  createMouseEventAtCurrentPosition (): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    event.position.copyFrom(this.mousePosition);
    event.globalPosition.copyFrom(this.globalMousePosition);
    event.buttonMask = this.mouseButtonMask;
    event.pressed = this.isMouseButtonPressed();
    event.shiftPressed = this.shiftPressed;
    event.altPressed = this.altPressed;
    event.metaPressed = this.metaPressed;
    event.ctrlPressed = this.ctrlPressed;

    return event;
  }

  /** 释放回调和输入状态。 */
  override onDestroy (): void {
    this.onMouseEnterCallback = null;
    this.onMouseMoveCallback = null;
    this.onMouseDragCallback = null;
    this.onMouseLeaveCallback = null;
    this.onMouseWheelCallback = null;
    this.onMouseDownCallback = null;
    this.onMouseUpCallback = null;
    this.onKeyDownCallback = null;
    this.onKeyUpCallback = null;
    this.onUpdateCallback = null;
    this.drawCallBack = null;
    this.mousePosition.setZero();
    this.globalMousePosition.setZero();
    this.mouseInside = false;
    this.mouseButtonMask = MouseButtonMask.None;
    this.dragThresholdState = DragThresholdState.Idle;
    this.dragStart.setZero();
    this.shiftPressed = false;
    this.altPressed = false;
    this.metaPressed = false;
    this.ctrlPressed = false;
    super.onDestroy();
  }

  /**
   * 记录鼠标位置与修饰键状态。
   * @param event 鼠标事件
   */
  private recordMouseInput (event: InputEventMouse): void {
    this.mousePosition.copyFrom(event.position);
    this.globalMousePosition.copyFrom(event.globalPosition);
    this.mouseButtonMask = event.buttonMask;
    this.recordModifiers(event);
  }

  /**
   * 记录修饰键状态。
   * @param event 带修饰键的输入事件
   */
  private recordModifiers (event: InputEventWithModifiers): void {
    this.shiftPressed = event.shiftPressed;
    this.altPressed = event.altPressed;
    this.metaPressed = event.metaPressed;
    this.ctrlPressed = event.ctrlPressed;
  }
}
