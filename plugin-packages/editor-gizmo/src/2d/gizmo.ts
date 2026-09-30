import type {
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from './gizmo-owner';

/** 定义 Gizmo 的绘制、鼠标和键盘交互生命周期。 */
export abstract class Gizmo {
  /** Gizmo 类型标识（子类必须实现）。 */
  abstract readonly type: string;

  /** Gizmo 共享状态的宿主契约。 */
  protected readonly _owner: GizmoOwner;

  /**
   * 创建 Gizmo。
   * @param owner 宿主契约
   */
  constructor (owner: GizmoOwner) {
    this._owner = owner;
  }

  /** 释放资源。子类可覆盖清理。 */
  dispose (): void {
    // 子类按需释放资源。
  }

  /** 在每帧更新时同步内部渲染状态。 */
  onUpdate (): void {
    // 子类按需同步渲染状态。
  }

  /** 在输入候选仲裁前更新命中状态。 */
  prepareForDispatch (): void {
    // 子类按需准备命中状态。
  }

  /** @returns 是否需要越过拖拽阈值后才接收拖拽事件。 */
  requiresDragThreshold (): boolean {
    return true;
  }

  /**
   * 绘制 Gizmo 视觉元素。
   * @param _control 绘制控制器
   */
  draw (_control: Control): void {
    // 子类按需绘制视觉元素。
  }

  /**
   * 处理鼠标按下并按需接管交互会话。
   * @param _event 鼠标按下事件
   */
  onMouseDown (_event: InputEventMouseButton): void {
    // 子类按需处理鼠标按下。
  }

  /**
   * 处理鼠标抬起并结束交互会话。
   * @param _event 鼠标抬起事件
   */
  onMouseUp (_event: InputEventMouseButton): void {
    // 子类按需处理鼠标抬起。
  }

  /**
   * 处理无按键状态的鼠标移动。
   * @param _event 鼠标移动事件
   */
  onMouseMove (_event: InputEventMouseMotion): void {
    // 子类按需处理鼠标移动。
  }

  /**
   * 处理越过距离阈值后的鼠标拖拽。
   * @param _event 鼠标拖拽事件
   */
  onMouseDrag (_event: InputEventMouseMotion): void {
    // 子类按需处理鼠标拖拽。
  }

  /** 处理鼠标离开并清理悬停状态。 */
  onMouseLeave (): void {
    // 子类按需清理悬停状态。
  }

  /**
   * 处理键盘按下。
   * @param _event 键盘按下事件
   */
  onKeyDown (_event: InputEventKey): void {
    // 子类按需处理键盘按下。
  }

  /**
   * 处理键盘抬起。
   * @param _event 键盘抬起事件
   */
  onKeyUp (_event: InputEventKey): void {
    // 子类按需处理键盘抬起。
  }
}
