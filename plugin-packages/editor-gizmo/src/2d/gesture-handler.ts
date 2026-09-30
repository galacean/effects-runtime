import { type Engine, type InputEvent, type InputEventKey, type InputEventMouse, type InputEventMouseButton, type InputEventMouseMotion } from '@galacean/effects';
import { Control, MouseFilter, type ControlEvent } from '@galacean/effects-plugin-gui';
import { cursorMap, loadCursorIcons } from './cursor-icons';
import type { Gizmo } from './gizmo';
import type { GizmoOwner, SelectionTransformKind } from './gizmo-owner';
import { GizmoManager, type GizmoErrorPhase } from './gizmo-manager';
import { GestureCursorType, type GestureCursorResult } from './cursor';
import type { HoveringResults } from './selection/selection';
import type { ConfigManager } from './configs/config-manager';
import { selectionPreviewConfig } from './configs/builtin-configs';
import { Vector2, getTransformedBoxCorners } from './math';
import { FrameManager } from './frame/frame-manager';
import { Selection } from './selection/selection';
import { SnapManager } from './selection/snap-manager';
import { LoadingManager } from './gizmos/loading-manager';
import { LoadingGizmo } from './gizmos/loading-gizmo';
import { HandGizmo } from './gizmos/hand-gizmo';
import { IconGizmo } from './gizmos/icon-gizmo';
import { drawCorners, toColor } from './drawing';
import {
  getItemViewTransform,
  getPlayerItemById,
  pauseEffectsItem,
  pauseVideoItem,
  playEffectsItem,
  playVideoItem,
} from './items';
import { GizmoViewportUtils, ViewportNavigationController } from './viewport';
import { GizmoTool } from './gizmo-tool';
import { HandGizmoTool } from './gizmo-tools/hand-gizmo-tool';
import { DefaultSelectionMode, type EditMode } from './modes';
import { GizmoViewport } from './viewport/gizmo-viewport';
import type { GizmoOwnerEvents } from './gizmo-action';

/** Runtime Control 输入事件的派发阶段。 */
enum ControlInputPhase {
  /** 鼠标进入交互区域。 */
  MouseEnter,
  /** 鼠标悬停移动。 */
  MouseMove,
  /** 鼠标拖拽移动。 */
  MouseDrag,
  /** 鼠标离开交互区域。 */
  MouseLeave,
  /** 鼠标滚轮输入。 */
  MouseWheel,
  /** 鼠标按下。 */
  MouseDown,
  /** 鼠标抬起。 */
  MouseUp,
  /** 键盘按下。 */
  KeyDown,
  /** 键盘抬起。 */
  KeyUp,
}

/** Gizmo 错误上报接口。 */
export interface GizmoErrorMonitor {
  /**
   * 上报指定阶段的 Gizmo 错误。
   * @param error 原始错误。
   * @param phase 错误发生阶段。
   * @param ctx 错误上下文。
   */
  report(error: unknown, phase: GizmoErrorPhase, ctx: {
    /** 发生错误的 Gizmo 类型。 */
    gizmoType?: string,
  }): void,
}

/** 接收运行时输入，并协调 Gizmo、选区和视口导航。 */
export class GestureHandler extends Control implements GizmoOwner {
  /** 抓手与滚轮共享的视口导航控制器。 */
  private viewportNavigation: ViewportNavigationController;

  /** 当前对外可观察的 hover 命中结果。 */
  private hoveringResults: HoveringResults = {};

  /** Runtime Control 输入入口；持有输入状态并完成 Move/Drag 分流。 */
  private gizmoViewport: GizmoViewport | undefined;

  /** 所有 Gizmo 共享的画板模型。 */
  private frameManager: FrameManager;

  /** 交互上下文共享的吸附器；跨图重建保持同一实例。 */
  private snapManager: SnapManager;

  /** 加载状态管理器。 */
  private loadingManager = new LoadingManager();

  /** Gizmo 生命周期管理器。 */
  private gizmoManager: GizmoManager;

  /** 当前激活的工具。 */
  private activeGizmoTool = new GizmoTool(this);

  /** 当前编辑模式。 */
  private editMode: EditMode;

  /** 宿主提供的默认编辑模式工厂。 */
  private defaultEditModeFactory?: (owner: GizmoOwner) => EditMode;

  /** 选中状态与命中查询器。 */
  private selection: Selection;

  /** 当前 hover 的元素；用于在目标切换、离开或销毁时结束媒体预览。 */
  private hoveredMediaItemId: string | undefined;

  /** 错误上报器（按需注入，未注入时不生效）。 */
  private errorMonitor: GizmoErrorMonitor | undefined;

  /** 是否屏蔽所有交互。 */
  private _ignoreInteraction = false;
  /** 当前指针序列捕获的 Gizmo。 */
  private capturedGizmo: Gizmo | undefined;

  /** 独立于指针捕获者的选区变换状态。 */
  private selectionTransformKind: SelectionTransformKind = 'idle';
  /** 等待指针序列结束后销毁的退场 Gizmo。 */
  private gizmosToDispose: Gizmo[] = [];

  /**
   * 悬停目标变化时同步视频与特效预览。
   * @param preSelectedId 新悬停元素 ID。
   */
  private onPreselectChange = ({ preSelectedId }: { preSelectedId: string | undefined }): void => {
    const previousId = this.hoveredMediaItemId;
    const previewEnabled = this.gizmoManager.configs
      .get(selectionPreviewConfig)
      .videoPreSelectedPlay;

    if (preSelectedId && previewEnabled) {
      playVideoItem(this.engine, preSelectedId);
      playEffectsItem(this.engine, preSelectedId);
    }
    if (previousId) {
      pauseVideoItem(this.engine, previousId);
      pauseEffectsItem(this.engine, previousId);
    }

    this.hoveredMediaItemId = preSelectedId;
  };

  /**
   * 创建手势处理器并装配基础交互状态。
   * @param engine Effects 引擎。
   */
  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Pass;
    this.mouseForcePassScrollEvents = false;
    this.setAnchorsAndOffsetsPreset('fullRect');
    this.frameManager = new FrameManager(engine);
    this.gizmoManager = new GizmoManager();
    this.viewportNavigation = new ViewportNavigationController(this);
    this.selection = new Selection(engine, this.hoveringResults);
    this.snapManager = new SnapManager(this);
    this.editMode = this.createDefaultEditMode();

    this.selection.on('preselectchange', this.onPreselectChange);
    this.createViewport();
    void loadCursorIcons();
  }

  /** 订阅原生控件或 Gizmo 业务事件。 */
  override on<E extends keyof (ControlEvent & GizmoOwnerEvents)> (
    eventName: E,
    listener: (...args: (ControlEvent & GizmoOwnerEvents)[E]) => void,
  ): () => void;
  override on (eventName: any, listener: any): () => void {
    super.on(eventName, listener);

    return () => {
      this.off(eventName, listener);
    };
  }

  /** 取消原生控件或 Gizmo 业务事件订阅。 */
  override off<E extends keyof (ControlEvent & GizmoOwnerEvents)> (
    eventName: E,
    listener: (...args: (ControlEvent & GizmoOwnerEvents)[E]) => void,
  ): void;
  override off (eventName: any, listener: any): void {
    super.off(eventName, listener);
  }

  /** 发出 Gizmo 业务事件。 */
  emit<E extends keyof GizmoOwnerEvents> (eventName: E, ...args: GizmoOwnerEvents[E]): void {
    // Control does not expose emit yet; use its existing event storage.
    const emitter = (this as any).eventEmitter;

    emitter.emit(eventName, ...args);
  }

  /** 是否屏蔽交互。 */
  get ignoreInteraction (): boolean {
    return this._ignoreInteraction;
  }

  /**
   * 设置是否屏蔽所有 Gizmo 与选区交互。
   * @param state 是否屏蔽交互。
   */
  set ignoreInteraction (state: boolean) {
    if (state === this._ignoreInteraction) {
      return;
    }
    this._ignoreInteraction = state;
  }

  /** @returns 当前选区与命中查询对象。 */
  getSelection (): Selection {
    return this.selection;
  }

  /** @returns 当前画板管理器。 */
  getFrameManager (): FrameManager {
    return this.frameManager;
  }

  /** @returns 共享吸附管理器。 */
  getSnapManager (): SnapManager {
    return this.snapManager;
  }

  /** @returns 加载状态管理器。 */
  getLoadingManager (): LoadingManager {
    return this.loadingManager;
  }

  /** @returns 共享视口导航控制器。 */
  getViewportNavigation (): ViewportNavigationController {
    return this.viewportNavigation;
  }

  /** @returns 当前选区变换状态。 */
  getSelectionTransformKind (): SelectionTransformKind {
    return this.selectionTransformKind;
  }

  /**
   * 设置选区变换状态。
   * @param kind 选区变换状态。
   */
  setSelectionTransformKind (kind: SelectionTransformKind): void {
    this.selectionTransformKind = kind;
  }

  /** @returns 当前激活的编辑模式。 */
  getActiveEditMode (): EditMode {
    return this.editMode;
  }

  /**
   * 切换编辑模式并重建 Gizmo 图。
   * @param mode 新编辑模式。
   */
  setActiveEditMode (mode: EditMode): void {
    if (mode === this.editMode) {
      return;
    }
    this.commitEditMode(mode);
    this.redispatchMouseAtCurrentPosition();
  }

  /**
   * 注册重置和退出子编辑模式时使用的默认模式工厂。
   * @param factory 默认编辑模式工厂。
   */
  registerDefaultEditModeFactory (factory: (owner: GizmoOwner) => EditMode): void {
    this.defaultEditModeFactory = factory;
    if (this.editMode instanceof DefaultSelectionMode) {
      this.setActiveEditMode(factory(this));
    }
  }

  /** 恢复新的默认编辑模式。 */
  resetEditMode (): void {
    if (this.editMode instanceof DefaultSelectionMode) {
      return;
    }
    this.setActiveEditMode(this.createDefaultEditMode());
  }

  /** 初始化当前工具与编辑模式对应的 Gizmo 图。 */
  init (): void {
    try {
      this.rebuildGizmos();
    } catch (error) {
      this.errorMonitor?.report(error, 'gizmo-init', { gizmoType: 'unknown' });
      throw error;
    }
  }

  /** @returns 当前鼠标的 Control 本地坐标。 */
  getMousePosition (): Vector2 {
    return this.gizmoViewport?.getMousePosition() ?? new Vector2();
  }

  /**
   * 更新交互层的 CSS 光标。
   * @param result Gizmo 光标结果。
   */
  setCursor (result: GestureCursorResult): void {
    const control = this.gizmoViewport;

    if (!control) {
      return;
    }
    let cssCursor = 'default';

    if (result.type === GestureCursorType.CIRCLE) {
      const radius = result.radius || 10;
      const svgStr = encodeURIComponent(`<svg width="${radius * 2}" height="${radius * 2}" xmlns="http://www.w3.org/2000/svg"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="rgba(255, 255, 255, 0.6)" stroke="#6A34FF" stroke-width="1" /></svg>`);

      cssCursor = `url("data:image/svg+xml,${svgStr}") ${radius} ${radius}, auto`;
    } else {
      const cursor = cursorMap[result.type];

      if (cursor?.type === 'svg') {
        const pointerShift = 16;
        const svg = encodeURIComponent(cursor.content.replace('rotate(0.00)', `rotate(${result.angle ?? 0})`));

        cssCursor = `url("data:image/svg+xml,${svg}") ${pointerShift} ${pointerShift}, auto`;
      } else if (cursor?.type === 'preset') {
        cssCursor = cursor.content;
      }
    }
    control.defaultCursorShape = cssCursor;
  }

  /** @returns 当前 Gizmo 生命周期管理器。 */
  getGizmoManager (): GizmoManager {
    return this.gizmoManager;
  }

  /** @returns Effects 引擎。 */
  getEngine (): Engine {
    return this.engine;
  }

  /** @returns Gizmo 配置管理器。 */
  getConfigManager (): ConfigManager {
    return this.gizmoManager.configs;
  }

  /** @returns 当前是否为抓手工具。 */
  isHandToolMode (): boolean {
    return this.activeGizmoTool instanceof HandGizmoTool;
  }

  /** @returns 当前是否有鼠标按键按下。 */
  isMouseButtonPressed (): boolean {
    return this.gizmoViewport?.isMouseButtonPressed() ?? false;
  }

  /** 重建公共 Gizmo 与当前工具或编辑模式的 Gizmo 图。 */
  rebuildGizmos (): void {
    const specificGizmos = this.activeGizmoTool.createGizmos();

    this.gizmosToDispose.push(...this.gizmoManager.activeGizmos);
    this.gizmoManager.activeGizmos = [
      ...this.createCommonBeforeToolSwitch(),
      ...specificGizmos,
    ];
  }

  /**
   * 切换活动工具并协调编辑模式。
   * @param gizmoTool 新活动工具。
   */
  setActiveTool (gizmoTool: GizmoTool): void {
    this.activeGizmoTool = gizmoTool;
    this.commitEditMode(this.resolveEditModeForTool(gizmoTool));
    this.disposeQueuedGizmos();
  }

  /**
   * 注入错误上报器（由宿主调用，未注入时不影响现有行为）。
   * @param reporter 错误上报器实例
   */
  setErrorMonitor (reporter?: GizmoErrorMonitor): void {
    this.errorMonitor = reporter;
  }

  /** 释放资源：解绑订阅、清交互状态，并销毁当前 Gizmo 图。 */
  override onDestroy (): void {
    this.editMode.onExit?.();
    this.clearCapturedGizmo();
    this.selection.off('preselectchange', this.onPreselectChange);
    if (this.hoveredMediaItemId) {
      pauseVideoItem(this.engine, this.hoveredMediaItemId);
      pauseEffectsItem(this.engine, this.hoveredMediaItemId);
      this.hoveredMediaItemId = undefined;
    }
    this.clearCapturedGizmo();
    this.disposeQueuedGizmos();
    this.gizmoManager.dispose();
    this.viewportNavigation.dispose();

    this.selectionTransformKind = 'idle';
    this.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
    this.gizmoViewport = undefined;
    super.onDestroy();
  }

  /** 每帧更新入口：先刷新 Frame 投影，再同步当前 Gizmo 图。 */
  override update (deltaTime: number): void {
    this.frameManager.onUpdate();
    this.gizmoManager.onUpdate();
    super.update(deltaTime);
  }

  /** 创建填满交互根控件的输入与绘制子控件。 */
  private createViewport (): void {
    const gizmoViewport = this.addChild(new GizmoViewport(this.engine));

    gizmoViewport.onMouseEnterCallback = () => {
      this.dispatchInput(ControlInputPhase.MouseEnter, gizmoViewport.createMouseEventAtCurrentPosition());
    };
    gizmoViewport.onMouseMoveCallback = event => {
      this.dispatchInput(ControlInputPhase.MouseMove, event);
    };
    gizmoViewport.onMouseDragCallback = event => {
      this.dispatchInput(ControlInputPhase.MouseDrag, event);
    };
    gizmoViewport.onMouseLeaveCallback = () => {
      this.dispatchInput(ControlInputPhase.MouseLeave, gizmoViewport.createMouseEventAtCurrentPosition());
    };
    gizmoViewport.onMouseWheelCallback = event => {
      this.dispatchInput(ControlInputPhase.MouseWheel, event);
    };
    gizmoViewport.onMouseDownCallback = event => {
      this.dispatchInput(ControlInputPhase.MouseDown, event);
    };
    gizmoViewport.onMouseUpCallback = event => {
      this.dispatchInput(ControlInputPhase.MouseUp, event);
    };
    gizmoViewport.onKeyDownCallback = event => {
      this.dispatchInput(ControlInputPhase.KeyDown, event);
    };
    gizmoViewport.onKeyUpCallback = event => {
      this.dispatchInput(ControlInputPhase.KeyUp, event);
    };
    gizmoViewport.drawCallBack = () => {
      this.drawGizmos(gizmoViewport);
    };
    this.gizmoViewport = gizmoViewport;
  }

  /**
   * 按退出、重建、进入的顺序提交编辑模式。
   * @param nextMode 新编辑模式。
   */
  private commitEditMode (nextMode: EditMode): void {
    const previousMode = this.editMode;
    const modeChanged = previousMode !== nextMode;

    if (modeChanged) {
      previousMode.onExit?.();
      this.editMode = nextMode;
    }

    this.rebuildGizmos();

    if (modeChanged) {
      nextMode.onEnter?.();
    }
  }

  /**
   * 解析指定工具可继续使用的编辑模式。
   * @param tool 目标工具。
   * @returns 可用编辑模式。
   */
  private resolveEditModeForTool (tool: GizmoTool): EditMode {
    if (
      this.editMode.canRemainActiveForTool(tool)
      || this.editMode instanceof DefaultSelectionMode
    ) {
      return this.editMode;
    }

    return this.createDefaultEditMode();
  }

  /** @returns 新建的默认编辑模式。 */
  private createDefaultEditMode (): EditMode {
    return this.defaultEditModeFactory
      ? this.defaultEditModeFactory(this)
      : new DefaultSelectionMode(this);
  }

  /**
   * 按输入阶段派发 Runtime Control 事件。
   * @param phase 输入阶段。
   * @param input 已归一化的输入事件。
   */
  private dispatchInput (
    phase: ControlInputPhase,
    input: InputEvent,
  ): void {
    // 步骤 1：跳过已接受或被全局屏蔽的事件。
    if (!this.ignoreInteraction && !input.isAccepted()) {
      // 步骤 2：将滚轮、鼠标和键盘事件路由到对应处理器。
      switch (phase) {
        case ControlInputPhase.MouseWheel: {
          const viewportChanged = this.viewportNavigation.handleWheel(
            input as InputEventMouseButton,
            Boolean(this.capturedGizmo),
          );

          if (viewportChanged) {
            this.redispatchMouseAtCurrentPosition();
          }

          break;
        }
        case ControlInputPhase.MouseEnter:
        case ControlInputPhase.MouseMove:
        case ControlInputPhase.MouseDrag:
        case ControlInputPhase.MouseLeave:
        case ControlInputPhase.MouseDown:
        case ControlInputPhase.MouseUp:
          this.handleMouseInput(phase, input as InputEventMouse);

          break;
        case ControlInputPhase.KeyDown: {
          const event = input as InputEventKey;

          this.emit('keyDown', event);
          if (!event.isAccepted()) {
            this.handleKeyboardEvent(event, 'down');
          }

          break;
        }
        case ControlInputPhase.KeyUp: {
          const event = input as InputEventKey;

          this.emit('keyUp', event);
          if (!event.isAccepted()) {
            this.handleKeyboardEvent(event, 'up');
          }

          break;
        }
      }
    }
    // 步骤 3：在当前事件出口释放可安全销毁的退场 Gizmo。
    this.disposeQueuedGizmos();
  }

  /** @returns 所有工具共享的视口 Gizmo。 */
  private createCommonBeforeToolSwitch (): Gizmo[] {
    return [
      new HandGizmo(this),
      new IconGizmo(this),
      new LoadingGizmo(this, this.loadingManager),
    ];
  }

  /** @returns 抓手 Gizmo 当前是否正在平移或等待平移。 */
  private isPanning (): boolean {
    return this.gizmoManager.get('hand')?.isPanning() ?? false;
  }

  /**
   * 处理鼠标阶段并维护指针捕获。
   * @param phase 输入阶段。
   * @param event 鼠标事件。
   */
  private handleMouseInput (
    phase: ControlInputPhase,
    event: InputEventMouse,
  ): void {
    if (phase === ControlInputPhase.MouseDown) {
      this.clearCapturedGizmo();
    }

    const savedOwner = this.capturedGizmo;

    // 抬起事件派发前释放持久捕获，但保留本轮接收者。
    if (phase === ControlInputPhase.MouseUp) {
      this.clearCapturedGizmo();
    }

    let winner: Gizmo | undefined;

    if (this.canDispatchMouseEvent(phase, savedOwner)) {
      this.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
      winner = this.dispatchMouseEvent(savedOwner, phase, event);
    }

    if (phase === ControlInputPhase.MouseDown) {
      this.capturedGizmo = winner;
    }

    if (phase === ControlInputPhase.MouseUp) {
      this.redispatchMouseAtCurrentPosition();
    }
  }

  /**
   * 向本轮捕获者或活动候选派发鼠标事件。
   * @param localOwner 本轮捕获者。
   * @param phase 输入阶段。
   * @param event 鼠标事件。
   * @returns 接受事件的 Gizmo。
   */
  private dispatchMouseEvent (
    localOwner: Gizmo | undefined,
    phase: ControlInputPhase,
    event: InputEventMouse,
  ): Gizmo | undefined {
    this.selection.clearHover();

    if (localOwner) {
      this.invoke(localOwner, phase, event);

      return localOwner;
    }

    // 使用候选快照，图重建只影响下一轮派发。
    const candidates = [...this.gizmoManager.activeGizmos];

    for (const gizmo of candidates) {
      this.prepareForDispatch(gizmo, phase);
    }

    for (const gizmo of candidates) {
      if (this.invoke(gizmo, phase, event)) {
        return gizmo;
      }
    }

    return undefined;
  }

  /**
   * 判断当前鼠标轮次是否可以进入行为派发。
   * @param phase 输入阶段。
   * @param savedOwner 本轮开始时的捕获者。
   * @returns 是否允许派发。
   */
  private canDispatchMouseEvent (
    phase: ControlInputPhase,
    savedOwner: Gizmo | undefined,
  ): boolean {
    if (
      phase === ControlInputPhase.MouseDrag
      && !this.gizmoViewport?.hasCrossedDragThreshold()
      && (!savedOwner || savedOwner.requiresDragThreshold())
    ) {
      return false;
    }

    if (savedOwner) {
      return true;
    }

    switch (phase) {
      case ControlInputPhase.MouseDown:
      case ControlInputPhase.MouseMove:
      case ControlInputPhase.MouseLeave:
        return true;
      case ControlInputPhase.MouseEnter:
      case ControlInputPhase.MouseDrag:
      case ControlInputPhase.MouseUp:
      case ControlInputPhase.MouseWheel:
      case ControlInputPhase.KeyDown:
      case ControlInputPhase.KeyUp:
        return false;
    }
  }

  /** 释放持久指针捕获。 */
  private clearCapturedGizmo (): void {
    this.capturedGizmo = undefined;
  }

  /** 在最新鼠标位置重新派发移动或拖拽事件。 */
  private redispatchMouseAtCurrentPosition (): void {
    const localOwner = this.capturedGizmo;
    const viewport = this.gizmoViewport;

    if (!viewport || (!localOwner && !viewport.isMouseInside())) {
      return;
    }

    const event = viewport.createMouseEventAtCurrentPosition();

    this.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
    this.dispatchMouseEvent(
      localOwner,
      localOwner ? ControlInputPhase.MouseDrag : ControlInputPhase.MouseMove,
      event,
    );
  }

  /** 在捕获者不属于退场图时释放待销毁 Gizmo。 */
  private disposeQueuedGizmos (): void {
    if (
      this.capturedGizmo
      && this.gizmosToDispose.includes(this.capturedGizmo)
    ) {
      return;
    }

    const gizmosToDispose = this.gizmosToDispose;

    this.gizmosToDispose = [];
    for (const gizmo of gizmosToDispose) {
      gizmo.dispose();
    }
  }

  /**
   * 准备单个派发候选并隔离错误。
   * @param gizmo 候选 Gizmo。
   * @param phase 输入阶段。
   */
  private prepareForDispatch (gizmo: Gizmo, phase: ControlInputPhase): void {
    try {
      gizmo.prepareForDispatch?.();
    } catch (error) {
      this.handleGizmoError(error, this.errorPhaseFor(phase), gizmo.type);
    }
  }

  /**
   * 调用 Gizmo 对应的鼠标阶段并隔离错误。
   * @param gizmo 目标 Gizmo。
   * @param phase 输入阶段。
   * @param event 鼠标事件。
   * @returns Gizmo 是否接受事件。
   */
  private invoke (gizmo: Gizmo, phase: ControlInputPhase, event: InputEventMouse): boolean {
    try {
      switch (phase) {
        case ControlInputPhase.MouseEnter:
          break;
        case ControlInputPhase.MouseDown:
          gizmo.onMouseDown(event as InputEventMouseButton);

          break;
        case ControlInputPhase.MouseMove:
          gizmo.onMouseMove(event as InputEventMouseMotion);

          break;
        case ControlInputPhase.MouseDrag:
          gizmo.onMouseDrag(event as InputEventMouseMotion);

          break;
        case ControlInputPhase.MouseUp:
          gizmo.onMouseUp(event as InputEventMouseButton);

          break;
        case ControlInputPhase.MouseLeave:
          gizmo.onMouseLeave();

          break;
        case ControlInputPhase.MouseWheel:
        case ControlInputPhase.KeyDown:
        case ControlInputPhase.KeyUp:
          break;
      }
    } catch (error) {
      event.clearAccepted();
      this.handleGizmoError(error, this.errorPhaseFor(phase), gizmo.type);
    }

    return event.isAccepted();
  }

  /**
   * 按活动 Gizmo 快照派发键盘事件。
   * @param event 键盘事件。
   * @param phase 键盘输入阶段。
   */
  private handleKeyboardEvent (
    event: InputEventKey,
    phase: 'down' | 'up',
  ): void {
    for (const gizmo of [...this.gizmoManager.activeGizmos]) {
      try {
        if (phase === 'down') {
          gizmo.onKeyDown(event);
        } else {
          gizmo.onKeyUp(event);
        }
      } catch (error) {
        event.clearAccepted();
        this.handleGizmoError(error, 'gizmo-key', gizmo.type);
      }
      if (event.isAccepted()) {
        break;
      }
    }

    this.redispatchMouseAtCurrentPosition();
  }

  /**
   * 将输入阶段映射为错误上报阶段。
   * @param phase 输入阶段。
   * @returns 错误上报阶段。
   */
  private errorPhaseFor (phase: ControlInputPhase): GizmoErrorPhase {
    switch (phase) {
      case ControlInputPhase.MouseDown:
        return 'gizmo-actionstart';
      case ControlInputPhase.MouseEnter:
      case ControlInputPhase.MouseMove:
      case ControlInputPhase.MouseDrag:
      case ControlInputPhase.MouseLeave:
      case ControlInputPhase.MouseWheel:
        return 'gizmo-actionupdate';
      case ControlInputPhase.MouseUp:
        return 'gizmo-actioncommit';
      case ControlInputPhase.KeyDown:
      case ControlInputPhase.KeyUp:
        return 'gizmo-key';
    }
  }

  /**
   * 按悬停框、活动 Gizmo、吸附提示的顺序绘制交互层。
   * @param gizmoControl 绘制控制器。
   */
  private drawGizmos (gizmoControl: GizmoViewport): void {
    this.drawHoverOverlay(gizmoControl);

    for (const gizmo of this.gizmoManager.activeGizmos ?? []) {
      this.drawGizmo(gizmo, gizmoControl);
    }
    this.drawSnappingVisualizations(gizmoControl);
  }

  /**
   * 绘制当前悬停元素的底层轮廓。
   * @param gizmoControl 绘制控制器。
   */
  private drawHoverOverlay (gizmoControl: GizmoViewport): void {
    if (this.isPanning()) {
      return;
    }
    const itemId = this.selection.hoverOverlayItemId;

    if (!itemId) {
      return;
    }
    const item = getPlayerItemById(this.engine.sceneServer.compositions[0], itemId);
    const transform = item ? getItemViewTransform(item, GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!)) : undefined;

    if (!transform) {
      return;
    }
    const config = this.getConfigManager().get(selectionPreviewConfig);

    drawCorners(gizmoControl, getTransformedBoxCorners(transform), toColor(config.preSelectedColor, 1), config.preSelectedWidth);
  }

  /**
   * 绘制单个 Gizmo 并隔离错误。
   * @param gizmo 目标 Gizmo。
   * @param gizmoControl 绘制控制器。
   */
  private drawGizmo (gizmo: Gizmo, gizmoControl: GizmoViewport): void {
    try {
      gizmo.draw(gizmoControl);
    } catch (error) {
      this.errorMonitor?.report(error, 'gizmo-draw', { gizmoType: gizmo.type });
    }
  }

  /**
   * 绘制当前吸附提示。
   * @param control 绘制控制器。
   */
  private drawSnappingVisualizations (control: GizmoViewport): void {
    const visualizations = this.snapManager.getSnappingVisualizations();

    if (visualizations.length === 0) {
      return;
    }

    const { lineWidth, lineColor } = this.snapManager.config;
    const color = toColor(lineColor, 1);

    for (const line of visualizations) {
      control.drawLine(
        line.start.x,
        line.start.y,
        line.end.x,
        line.end.y,
        color,
        lineWidth,
      );
    }
  }

  /**
   * 上报 Gizmo 错误并重置共享交互状态。
   * @param error 原始错误。
   * @param phase 错误发生阶段。
   * @param gizmoType 发生错误的 Gizmo 类型。
   */
  private handleGizmoError (
    error: unknown,
    phase: GizmoErrorPhase,
    gizmoType?: string,
  ): void {
    this.errorMonitor?.report(error, phase, { gizmoType });

    this.clearCapturedGizmo();
    this.selectionTransformKind = 'idle';
    this.snapManager.reset();
  }
}
