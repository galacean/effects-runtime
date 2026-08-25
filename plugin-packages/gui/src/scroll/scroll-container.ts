import {
  Container,
  EventEmitter,
  FocusMode,
  MouseButton,
  SizeFlags,
  math,
} from '@galacean/effects';
import type {
  Control,
  ControlEvent,
  Engine,
  EventEmitterListener,
  InputEventMouseButton,
  InputEventScreenDrag,
  InputEventScreenTouch,
  RootControl,
} from '@galacean/effects';
import { ScrollMode } from './enums';
import { HScrollBar, ScrollBar, VScrollBar } from './scroll-bar';

export type ScrollContainerEvent = ControlEvent & {
  scrollStarted: [],
  scrollEnded: [],
};

type ScrollLayout = {
  horizontalVisible: boolean,
  verticalVisible: boolean,
  horizontalReserved: boolean,
  verticalReserved: boolean,
  viewportWidth: number,
  viewportHeight: number,
};

const INERTIA_DECELERATION = 1000;

/** Clips and scrolls its content children using two internal Range scroll bars. */
export class ScrollContainer extends Container {
  private readonly scrollContainerEventEmitter = new EventEmitter<ScrollContainerEvent>();
  private readonly horizontalBar: HScrollBar;
  private readonly verticalBar: VScrollBar;
  private _horizontalScrollMode = ScrollMode.Auto;
  private _verticalScrollMode = ScrollMode.Auto;
  private _scrollHorizontalByDefault = false;
  private _deadzone = 0;
  private _followFocus = false;
  private focusRoot: RootControl | null = null;
  private touchIndex: number | null = null;
  private touchDecelerating = false;
  private beyondDeadzone = false;
  private readonly dragSpeed = new math.Vector2();
  private readonly dragAccum = new math.Vector2();
  private readonly dragFrom = new math.Vector2();
  private readonly lastDragAccum = new math.Vector2();
  private motionSampleTime = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;

  private readonly scrollMoved = () => this.queueSort();
  private readonly controlStateChanged = () => {
    if (!this.visibleInHierarchy || !this.enabledInHierarchy) {
      this.cancelTouchDrag();
    }
  };
  private readonly focusOwnerChanged = (control: Control | null) => {
    if (this.followFocus && control && this.isContentDescendant(control)) {
      this.ensureControlVisible(control);
    }
  };

  constructor (engine: Engine) {
    super(engine);
    this.horizontalBar = new HScrollBar(engine);
    this.verticalBar = new VScrollBar(engine);
    this.horizontalBar.focusMode = FocusMode.None;
    this.verticalBar.focusMode = FocusMode.None;
    this.clipContents = true;
    this.addChild(this.horizontalBar);
    this.addChild(this.verticalBar);
    this.horizontalBar.on('valueChanged', this.scrollMoved);
    this.verticalBar.on('valueChanged', this.scrollMoved);
    this.on('visibilityChanged', this.controlStateChanged);
    this.on('enabledChanged', this.controlStateChanged);
  }

  get hScroll (): number {
    return this.horizontalBar.value;
  }

  set hScroll (value: number) {
    this.horizontalBar.setValue(value);
    this.cancelTouchDrag();
  }

  get vScroll (): number {
    return this.verticalBar.value;
  }

  set vScroll (value: number) {
    this.verticalBar.setValue(value);
    this.cancelTouchDrag();
  }

  get horizontalScrollMode (): ScrollMode {
    return this._horizontalScrollMode;
  }

  set horizontalScrollMode (value: ScrollMode) {
    assertScrollMode(value);
    if (this._horizontalScrollMode !== value) {
      this._horizontalScrollMode = value;
      this.invalidateScrollLayout();
    }
  }

  get verticalScrollMode (): ScrollMode {
    return this._verticalScrollMode;
  }

  set verticalScrollMode (value: ScrollMode) {
    assertScrollMode(value);
    if (this._verticalScrollMode !== value) {
      this._verticalScrollMode = value;
      this.invalidateScrollLayout();
    }
  }

  get horizontalCustomStep (): number {
    return this.horizontalBar.customStep;
  }

  set horizontalCustomStep (value: number) {
    this.horizontalBar.customStep = value;
  }

  get verticalCustomStep (): number {
    return this.verticalBar.customStep;
  }

  set verticalCustomStep (value: number) {
    this.verticalBar.customStep = value;
  }

  get scrollHorizontalByDefault (): boolean {
    return this._scrollHorizontalByDefault;
  }

  set scrollHorizontalByDefault (value: boolean) {
    this._scrollHorizontalByDefault = value;
  }

  get deadzone (): number {
    return this._deadzone;
  }

  set deadzone (value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('ScrollContainer deadzone must be a non-negative finite number.');
    }
    this._deadzone = value;
  }

  get followFocus (): boolean {
    return this._followFocus;
  }

  set followFocus (value: boolean) {
    this._followFocus = value;
  }

  override on<E extends keyof ScrollContainerEvent> (
    eventName: E,
    listener: EventEmitterListener<ScrollContainerEvent[E]>,
  ): void {
    if (eventName === 'scrollStarted' || eventName === 'scrollEnded') {
      this.scrollContainerEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof ScrollContainerEvent> (
    eventName: E,
    listener: EventEmitterListener<ScrollContainerEvent[E]>,
  ): void {
    if (eventName === 'scrollStarted' || eventName === 'scrollEnded') {
      this.scrollContainerEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  getHScrollBar (): HScrollBar {
    return this.horizontalBar;
  }

  getVScrollBar (): VScrollBar {
    return this.verticalBar;
  }

  override intersectsChildContent (child: Control, position: math.Vector2): boolean {
    if (child === this.horizontalBar || child === this.verticalBar) {
      return true;
    }
    const transform = this.getGlobalTransform2D().elements;
    const globalPosition = new math.Vector2(
      transform[0] * position.x + transform[3] * position.y + transform[6],
      transform[1] * position.x + transform[4] * position.y + transform[7],
    );

    if (this.verticalBar.visible && this.verticalBar.enabledInHierarchy &&
      this.verticalBar.hasPoint(this.verticalBar.makePositionLocal(globalPosition))) {
      return false;
    }
    if (this.horizontalBar.visible && this.horizontalBar.enabledInHierarchy &&
      this.horizontalBar.hasPoint(this.horizontalBar.makePositionLocal(globalPosition))) {
      return false;
    }

    return true;
  }

  ensureControlVisible (control: Control): void {
    if (!this.isContentDescendant(control)) {
      throw new Error('ScrollContainer can only reveal a descendant content control.');
    }
    const transform = control.getGlobalTransform2D().elements;
    const corners = [
      [0, 0],
      [control.width, 0],
      [0, control.height],
      [control.width, control.height],
    ];
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const corner of corners) {
      const global = new math.Vector2(
        transform[0] * corner[0] + transform[3] * corner[1] + transform[6],
        transform[1] * corner[0] + transform[4] * corner[1] + transform[7],
      );
      const local = this.makePositionLocal(global);

      left = Math.min(left, local.x);
      top = Math.min(top, local.y);
      right = Math.max(right, local.x);
      bottom = Math.max(bottom, local.y);
    }
    const horizontalDifference = Math.max(Math.min(left, 0), right - this.viewportWidth);
    const verticalDifference = Math.max(Math.min(top, 0), bottom - this.viewportHeight);

    this.horizontalBar.setValue(this.horizontalBar.value + horizontalDifference);
    this.verticalBar.setValue(this.verticalBar.value + verticalDifference);
  }

  override getMinimumSize (): math.Vector2 {
    return this.measureContent(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureContent(true);
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    const previousHorizontal = this.horizontalBar.value;
    const previousVertical = this.verticalBar.value;
    const horizontalEnabled = this.horizontalScrollMode !== ScrollMode.Disabled;
    const verticalEnabled = this.verticalScrollMode !== ScrollMode.Disabled;
    const swapAxes = this.scrollHorizontalByDefault !== event.shiftPressed;
    const verticalHidden = !this.verticalBar.visible && this.verticalScrollMode !== ScrollMode.ShowNever;
    const horizontalHidden = !this.horizontalBar.visible && this.horizontalScrollMode !== ScrollMode.ShowNever;
    const horizontalAmount = this.horizontalBar.page / ScrollBar.pageDivisor * event.factor;
    const verticalAmount = this.verticalBar.page / ScrollBar.pageDivisor * event.factor;

    if (event.buttonIndex === MouseButton.WheelUp) {
      if ((horizontalEnabled && swapAxes) || verticalHidden) {
        this.horizontalBar.scroll(-horizontalAmount);
      } else if (verticalEnabled) {
        this.verticalBar.scroll(-verticalAmount);
      }
    } else if (event.buttonIndex === MouseButton.WheelDown) {
      if ((horizontalEnabled && swapAxes) || verticalHidden) {
        this.horizontalBar.scroll(horizontalAmount);
      } else if (verticalEnabled) {
        this.verticalBar.scroll(verticalAmount);
      }
    } else if (event.buttonIndex === MouseButton.WheelLeft) {
      if ((verticalEnabled && swapAxes) || horizontalHidden) {
        this.verticalBar.scroll(-verticalAmount);
      } else if (horizontalEnabled) {
        this.horizontalBar.scroll(-horizontalAmount);
      }
    } else if (event.buttonIndex === MouseButton.WheelRight) {
      if ((verticalEnabled && swapAxes) || horizontalHidden) {
        this.verticalBar.scroll(verticalAmount);
      } else if (horizontalEnabled) {
        this.horizontalBar.scroll(horizontalAmount);
      }
    }
    if (previousHorizontal !== this.horizontalBar.value || previousVertical !== this.verticalBar.value) {
      event.accept();
    }
  }

  override onTouchDown (event: InputEventScreenTouch): void {
    if (this.touchIndex !== null) {
      this.cancelTouchDrag();
    }
    this.touchIndex = event.index;
    this.touchDecelerating = false;
    this.beyondDeadzone = false;
    this.dragSpeed.set(0, 0);
    this.dragAccum.set(0, 0);
    this.lastDragAccum.set(0, 0);
    this.dragFrom.set(this.horizontalBar.value, this.verticalBar.value);
    this.motionSampleTime = 0;
  }

  override onTouchMove (event: InputEventScreenDrag): void {
    if (this.touchIndex !== event.index || this.touchDecelerating) {
      return;
    }
    const previousHorizontal = this.horizontalBar.value;
    const previousVertical = this.verticalBar.value;

    this.dragAccum.x -= event.relative.x;
    this.dragAccum.y -= event.relative.y;
    const horizontalEnabled = this.horizontalScrollMode !== ScrollMode.Disabled;
    const verticalEnabled = this.verticalScrollMode !== ScrollMode.Disabled;
    const exceedsDeadzone = this.beyondDeadzone ||
      (horizontalEnabled && Math.abs(this.dragAccum.x) > this.deadzone) ||
      (verticalEnabled && Math.abs(this.dragAccum.y) > this.deadzone);

    if (exceedsDeadzone) {
      if (!this.beyondDeadzone) {
        this.beyondDeadzone = true;
        this.dragAccum.set(-event.relative.x, -event.relative.y);
        this.notifyContentScroll(true);
        this.scrollContainerEventEmitter.emit('scrollStarted');
        this.root?.cancelPointerPress(this, event.index);
      }
      if (horizontalEnabled) {
        this.horizontalBar.scrollTo(this.dragFrom.x + this.dragAccum.x);
      } else {
        this.dragAccum.x = 0;
      }
      if (verticalEnabled) {
        this.verticalBar.scrollTo(this.dragFrom.y + this.dragAccum.y);
      } else {
        this.dragAccum.y = 0;
      }
    }
    if (previousHorizontal !== this.horizontalBar.value || previousVertical !== this.verticalBar.value) {
      event.accept();
    }
  }

  override onTouchUp (event: InputEventScreenTouch): void {
    if (this.touchIndex !== event.index) {
      return;
    }
    if (event.canceled || (this.dragSpeed.x === 0 && this.dragSpeed.y === 0)) {
      this.cancelTouchDrag();
    } else {
      this.touchDecelerating = true;
    }
  }

  override update (deltaTime: number): void {
    const seconds = Math.max(0, deltaTime) / 1000;

    if (!this.visibleInHierarchy || !this.enabledInHierarchy) {
      this.cancelTouchDrag();
    } else if (this.touchIndex !== null) {
      if (this.touchDecelerating) {
        this.updateInertia(seconds);
      } else if (this.beyondDeadzone) {
        this.updateDragVelocity(seconds);
      }
    }
    super.update(deltaTime);
  }

  override dispose (): void {
    this.horizontalBar.off('valueChanged', this.scrollMoved);
    this.verticalBar.off('valueChanged', this.scrollMoved);
    this.off('visibilityChanged', this.controlStateChanged);
    this.off('enabledChanged', this.controlStateChanged);
    this.focusRoot?.off('guiFocusChanged', this.focusOwnerChanged);
    this.focusRoot = null;
    this.cancelTouchDrag();
    super.dispose();
  }

  protected override drawChildren (): void {
    const graphics = this.engine.graphics;

    if (this.clipContents) {
      graphics.pushClipRect(0, 0, this.viewportWidth, this.viewportHeight);
    }
    try {
      for (const child of this.children) {
        if (child !== this.horizontalBar && child !== this.verticalBar) {
          child.drawInternal();
        }
      }
    } finally {
      if (this.clipContents) {
        graphics.popClipRect();
      }
    }
    this.verticalBar.drawInternal();
    this.horizontalBar.drawInternal();
  }

  protected override getLayoutChildren (): Control[] {
    return super.getLayoutChildren().filter(child => child !== this.horizontalBar && child !== this.verticalBar);
  }

  protected override onRootChanged (previousRoot: RootControl | null, nextRoot: RootControl | null): void {
    if (previousRoot === nextRoot) {
      return;
    }
    this.focusRoot?.off('guiFocusChanged', this.focusOwnerChanged);
    this.focusRoot = nextRoot;
    this.focusRoot?.on('guiFocusChanged', this.focusOwnerChanged);
  }

  protected override sortChildren (): void {
    const contentSize = this.getLargestContentSize(false);
    const layout = this.resolveLayout(contentSize);

    this.viewportWidth = layout.viewportWidth;
    this.viewportHeight = layout.viewportHeight;
    this.horizontalBar.visible = layout.horizontalVisible;
    this.verticalBar.visible = layout.verticalVisible;
    this.horizontalBar.setMaxValue(Math.max(contentSize.x, layout.viewportWidth));
    this.horizontalBar.setPage(layout.viewportWidth);
    this.verticalBar.setMaxValue(Math.max(contentSize.y, layout.viewportHeight));
    this.verticalBar.setPage(layout.viewportHeight);
    this.horizontalBar.setRect({
      position: new math.Vector2(0, this.height - this.horizontalBar.getBoundMinimumSize().y),
      size: new math.Vector2(layout.viewportWidth, this.horizontalBar.getBoundMinimumSize().y),
    });
    this.verticalBar.setRect({
      position: new math.Vector2(this.width - this.verticalBar.getBoundMinimumSize().x, 0),
      size: new math.Vector2(this.verticalBar.getBoundMinimumSize().x, layout.viewportHeight),
    });

    for (const child of this.getLayoutChildren()) {
      const minimum = child.getBoundMinimumSize();
      const maximum = child.getCombinedMaximumSize();
      let width = (child.horizontalSizeFlags & SizeFlags.Expand) !== 0
        ? Math.max(layout.viewportWidth, minimum.x)
        : minimum.x;
      let height = (child.verticalSizeFlags & SizeFlags.Expand) !== 0
        ? Math.max(layout.viewportHeight, minimum.y)
        : minimum.y;

      if (maximum.x >= 0) {
        width = Math.min(width, maximum.x);
      }
      if (maximum.y >= 0) {
        height = Math.min(height, maximum.y);
      }
      this.fitChildInRect(child, {
        position: new math.Vector2(
          Math.floor(-this.horizontalBar.value),
          Math.floor(-this.verticalBar.value),
        ),
        size: new math.Vector2(width, height),
      });
    }
  }

  private measureContent (useDesired: boolean): math.Vector2 {
    const content = this.getLargestContentSize(useDesired);
    const layout = this.resolveLayout(content);
    const maximum = this.getCombinedMaximumSize();
    const minimum = new math.Vector2();
    const horizontalConstrained = this.horizontalScrollMode === ScrollMode.Disabled ||
      this.horizontalScrollMode === ScrollMode.MaximizeFirst;
    const verticalConstrained = this.verticalScrollMode === ScrollMode.Disabled ||
      this.verticalScrollMode === ScrollMode.MaximizeFirst;

    if (this.horizontalScrollMode === ScrollMode.Disabled) {
      minimum.x = content.x;
    } else if (this.horizontalScrollMode === ScrollMode.MaximizeFirst) {
      minimum.x = maximum.x >= 0 ? Math.min(content.x, maximum.x) : content.x;
    }
    if (this.verticalScrollMode === ScrollMode.Disabled) {
      minimum.y = content.y;
    } else if (this.verticalScrollMode === ScrollMode.MaximizeFirst) {
      minimum.y = maximum.y >= 0 ? Math.min(content.y, maximum.y) : content.y;
    }
    if (horizontalConstrained && layout.verticalReserved) {
      minimum.x += this.verticalBar.getBoundMinimumSize().x;
    }
    if (verticalConstrained && layout.horizontalReserved) {
      minimum.y += this.horizontalBar.getBoundMinimumSize().y;
    }

    return minimum;
  }

  private getLargestContentSize (useDesired: boolean): math.Vector2 {
    const size = new math.Vector2();

    for (const child of this.getLayoutChildren()) {
      const childSize = useDesired ? child.getBoundDesiredSize() : child.getBoundMinimumSize();

      size.x = Math.max(size.x, childSize.x);
      size.y = Math.max(size.y, childSize.y);
    }

    return size;
  }

  private resolveLayout (content: math.Vector2): ScrollLayout {
    const horizontalSize = this.horizontalBar.getBoundMinimumSize().y;
    const verticalSize = this.verticalBar.getBoundMinimumSize().x;
    let horizontalVisible = this.horizontalScrollMode === ScrollMode.ShowAlways;
    let verticalVisible = this.verticalScrollMode === ScrollMode.ShowAlways;
    let horizontalReserved = horizontalVisible || this.horizontalScrollMode === ScrollMode.Reserve;
    let verticalReserved = verticalVisible || this.verticalScrollMode === ScrollMode.Reserve;

    for (let index = 0; index < 4; index++) {
      const viewportWidth = Math.max(0, this.width - (verticalReserved ? verticalSize : 0));
      const viewportHeight = Math.max(0, this.height - (horizontalReserved ? horizontalSize : 0));

      horizontalVisible = shouldShowBar(this.horizontalScrollMode, content.x, viewportWidth);
      verticalVisible = shouldShowBar(this.verticalScrollMode, content.y, viewportHeight);
      const nextHorizontalReserved = horizontalVisible || this.horizontalScrollMode === ScrollMode.Reserve;
      const nextVerticalReserved = verticalVisible || this.verticalScrollMode === ScrollMode.Reserve;

      if (horizontalReserved === nextHorizontalReserved && verticalReserved === nextVerticalReserved) {
        break;
      }
      horizontalReserved = nextHorizontalReserved;
      verticalReserved = nextVerticalReserved;
    }

    return {
      horizontalVisible,
      verticalVisible,
      horizontalReserved,
      verticalReserved,
      viewportWidth: Math.max(0, this.width - (verticalReserved ? verticalSize : 0)),
      viewportHeight: Math.max(0, this.height - (horizontalReserved ? horizontalSize : 0)),
    };
  }

  private invalidateScrollLayout (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
    this.queueSort();
  }

  private isContentDescendant (control: Control): boolean {
    let current: Control | null = control;

    while (current && current.parent !== this) {
      current = current.parent;
    }

    return !!current && current !== this.horizontalBar && current !== this.verticalBar && current.parent === this;
  }

  private notifyContentScroll (begin: boolean): void {
    const notify = (control: Control) => {
      if (begin) {
        control.onScrollBegin();
      } else {
        control.onScrollEnd();
      }
      for (const child of control.children) {
        notify(child);
      }
    };

    for (const child of this.getLayoutChildren()) {
      notify(child);
    }
  }

  private updateDragVelocity (seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    this.motionSampleTime += seconds;
    if (this.motionSampleTime >= 0.1 || (this.dragSpeed.x === 0 && this.dragSpeed.y === 0)) {
      this.dragSpeed.set(
        (this.dragAccum.x - this.lastDragAccum.x) / this.motionSampleTime,
        (this.dragAccum.y - this.lastDragAccum.y) / this.motionSampleTime,
      );
      this.lastDragAccum.copyFrom(this.dragAccum);
      this.motionSampleTime = 0;
    }
  }

  private updateInertia (seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    const previousHorizontal = this.horizontalBar.value;
    const previousVertical = this.verticalBar.value;

    if (this.horizontalScrollMode !== ScrollMode.Disabled) {
      this.horizontalBar.scrollTo(previousHorizontal + this.dragSpeed.x * seconds);
    } else {
      this.dragSpeed.x = 0;
    }
    if (this.verticalScrollMode !== ScrollMode.Disabled) {
      this.verticalBar.scrollTo(previousVertical + this.dragSpeed.y * seconds);
    } else {
      this.dragSpeed.y = 0;
    }
    if (this.horizontalBar.value === previousHorizontal && this.dragSpeed.x !== 0) {
      this.dragSpeed.x = 0;
    } else {
      this.dragSpeed.x = decelerate(this.dragSpeed.x, INERTIA_DECELERATION * seconds);
    }
    if (this.verticalBar.value === previousVertical && this.dragSpeed.y !== 0) {
      this.dragSpeed.y = 0;
    } else {
      this.dragSpeed.y = decelerate(this.dragSpeed.y, INERTIA_DECELERATION * seconds);
    }
    if (this.dragSpeed.x === 0 && this.dragSpeed.y === 0) {
      this.cancelTouchDrag();
    }
  }

  private cancelTouchDrag (): void {
    const notifyEnd = this.beyondDeadzone;

    this.touchIndex = null;
    this.touchDecelerating = false;
    this.beyondDeadzone = false;
    this.dragSpeed.set(0, 0);
    this.dragAccum.set(0, 0);
    this.dragFrom.set(0, 0);
    this.lastDragAccum.set(0, 0);
    this.motionSampleTime = 0;
    if (notifyEnd) {
      this.notifyContentScroll(false);
      this.scrollContainerEventEmitter.emit('scrollEnded');
    }
  }
}

function shouldShowBar (mode: ScrollMode, contentSize: number, viewportSize: number): boolean {
  if (mode === ScrollMode.ShowAlways) {
    return true;
  }
  if (mode === ScrollMode.Auto || mode === ScrollMode.Reserve || mode === ScrollMode.MaximizeFirst) {
    return contentSize > viewportSize;
  }

  return false;
}

function decelerate (value: number, amount: number): number {
  if (Math.abs(value) <= amount) {
    return 0;
  }

  return value - Math.sign(value) * amount;
}

function assertScrollMode (value: ScrollMode): void {
  if (!Number.isInteger(value) || value < ScrollMode.Disabled || value > ScrollMode.MaximizeFirst) {
    throw new RangeError('Invalid ScrollContainer scroll mode.');
  }
}
