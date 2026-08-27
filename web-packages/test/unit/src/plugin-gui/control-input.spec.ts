import {
  Composition,
  InputEvent,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  MouseButtonMask,
  Player,
  VFXItem,
  math,
} from '@galacean/effects';
import {
  Control,
  CursorShape,
  FocusMode,
  MouseFilter,
  UICanvas,
  UIControl,
  GUIRootComponent,
} from '@galacean/effects-plugin-gui';

const { expect } = chai;
const { Matrix3, Vector2 } = math;

class RecordingControl extends Control {
  readonly log: string[] = [];

  override onMouseDown (event: InputEventMouseButton): void {
    this.log.push(`down:${event.position.x},${event.position.y}`);
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.log.push(`move:${event.position.x},${event.position.y}`);
  }

  override onTouchDown (event: InputEventScreenTouch): void {
    this.log.push(`touch-down:${event.index}:${event.position.x},${event.position.y}`);
  }

  override onTouchMove (event: InputEventScreenDrag): void {
    this.log.push(`touch-move:${event.index}:${event.position.x},${event.position.y}`);
  }

  override onKeyDown (event: InputEventKey): void {
    this.log.push(`key:${event.keycode}`);
  }

  override onGotFocus (): void {
    this.log.push('focus');
  }

  override onLostFocus (): void {
    this.log.push('blur');
  }
}

class HoverRecordingControl extends RecordingControl {
  override onMouseEnter (): void {
    this.log.push('enter');
  }
}

class SelfHidingControl extends HoverRecordingControl {
  override onMouseEnter (): void {
    super.onMouseEnter();
    this.visible = false;
  }
}

class AcceptingControl extends RecordingControl {
  override onMouseDown (event: InputEventMouseButton): void {
    super.onMouseDown(event);
    event.accept();
  }
}

class MouseStateRecordingControl extends Control {
  readonly states: Array<{
    phase: 'down' | 'move' | 'up',
    buttonMask: MouseButtonMask,
    pressed: boolean,
  }> = [];

  override onMouseDown (event: InputEventMouseButton): void {
    this.record('down', event);
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.record('move', event);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    this.record('up', event);
  }

  private record (
    phase: 'down' | 'move' | 'up',
    event: InputEventMouseButton | InputEventMouseMotion,
  ): void {
    this.states.push({
      phase,
      buttonMask: event.buttonMask,
      pressed: event.pressed,
    });
  }
}

class CanvasBlurRecordingControl extends RecordingControl {
  readonly releases: InputEventMouseButton[] = [];
  mouseEnterCount = 0;
  mouseLeaveCount = 0;

  override onMouseUp (event: InputEventMouseButton): void {
    this.releases.push(event);
  }

  override onMouseEnter (): void {
    this.mouseEnterCount++;
  }

  override onMouseLeave (): void {
    this.mouseLeaveCount++;
  }
}

class DragSourceControl extends Control {
  protected override getDragData (): unknown {
    return 'drag-data';
  }
}

class DropTargetControl extends Control {
  readonly drops: unknown[] = [];

  protected override canDropData (): boolean {
    return true;
  }

  protected override dropData (_position: math.Vector2, data: unknown): void {
    this.drops.push(data);
  }
}

describe('plugin-gui/input', () => {
  let player: Player;
  let composition: Composition;

  beforeEach(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    });
    composition = new Composition(player.engine);
    composition.root.awake();
    composition.root.beginPlay();
  });

  afterEach(() => player.dispose());

  it('keeps acceptance state on InputEvent', () => {
    const event = new InputEvent();

    event.accept();
    expect(event.isAccepted()).equals(true);
    event.clearAccepted();
    expect(event.isAccepted()).equals(false);
  });

  it('only clones spatial events', () => {
    const transform = new Matrix3();
    const keyEvent = new InputEventKey();
    const mouseEvent = mouseButton(20, 20, true);
    const localMouseEvent = mouseEvent.xformedBy(transform);

    expect(keyEvent.xformedBy(transform)).equals(keyEvent);
    expect(localMouseEvent).not.equals(mouseEvent);

    localMouseEvent.accept();
    expect(localMouseEvent.isAccepted()).equals(true);
    expect(mouseEvent.isAccepted()).equals(false);
  });

  it('dispatches to the front-most control and bubbles through Pass parents', () => {
    const parent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const child = addControl(parent.item!, new RecordingControl(player.engine), 10, 10, 40, 40);

    parent.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;

    const event = mouseButton(20, 20, true);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(event);
    expect(child.log).deep.equals(['down:10,10']);
    expect(parent.log).deep.equals(['down:20,20']);
  });

  it('maps native canvas input from the top-left with Y increasing downward', () => {
    const order: string[] = [];

    player.canvas.focus = () => {
      order.push('focus');
    };
    player.canvas.getBoundingClientRect = () => {
      order.push('rect');

      return canvasRect();
    };
    const top = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 40);
    const bottom = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 60, 100, 40);

    player.canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 1,
    }));

    expect(top.log).deep.equals(['down:10,10']);
    expect(bottom.log).deep.equals([]);
    expect(order).deep.equals(['rect', 'focus']);
  });

  it('keeps the admitted button session through a release-edge motion with buttons=0', () => {
    player.canvas.getBoundingClientRect = canvasRect;
    const control = addControl(
      composition.sceneRoot,
      new MouseStateRecordingControl(player.engine),
      0, 0, 100, 100,
    );

    player.canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 21,
      clientY: 30,
      button: 0,
      buttons: 0,
    }));
    window.dispatchEvent(new MouseEvent('mouseup', {
      clientX: 21,
      clientY: 30,
      button: 0,
      buttons: 0,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 22,
      clientY: 30,
      button: 0,
      buttons: 0,
    }));

    expect(control.states).deep.equals([
      { phase: 'down', buttonMask: MouseButtonMask.Left, pressed: true },
      { phase: 'move', buttonMask: MouseButtonMask.Left, pressed: true },
      { phase: 'up', buttonMask: MouseButtonMask.None, pressed: false },
      { phase: 'move', buttonMask: MouseButtonMask.None, pressed: false },
    ]);
  });

  it('clears the canonical button mask after overlapping button releases', () => {
    player.canvas.getBoundingClientRect = canvasRect;
    const control = addControl(
      composition.sceneRoot,
      new MouseStateRecordingControl(player.engine),
      0, 0, 100, 100,
    );

    player.canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 1,
    }));
    player.canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: 20,
      clientY: 30,
      button: 2,
      buttons: 3,
    }));
    window.dispatchEvent(new MouseEvent('mouseup', {
      clientX: 20,
      clientY: 30,
      button: 2,
      buttons: 1,
    }));
    window.dispatchEvent(new MouseEvent('mouseup', {
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 0,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 21,
      clientY: 30,
      button: 0,
      buttons: 0,
    }));

    expect(control.states[control.states.length - 1]).deep.equals({
      phase: 'move',
      buttonMask: MouseButtonMask.None,
      pressed: false,
    });
  });

  it('focusing before mapping native touch coordinates', () => {
    const order: string[] = [];

    player.canvas.focus = () => {
      order.push('focus');
    };
    player.canvas.getBoundingClientRect = () => {
      order.push('rect');

      return canvasRect();
    };
    addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 40);
    const event = new Event('touchstart', { cancelable: true });

    Object.defineProperty(event, 'changedTouches', {
      value: [{ identifier: 7, clientX: 20, clientY: 30 }],
    });
    player.canvas.dispatchEvent(event);

    expect(order.slice(0, 2)).deep.equals(['focus', 'rect']);
  });

  it('keeps native legacy pointer events in bottom-left Y-up NDC', () => {
    player.canvas.getBoundingClientRect = () => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });
    let pointerY = 0;

    player.engine.eventSystem.addEventListener('touchstart', event => {
      pointerY = event.y;
    });
    player.canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 1,
    }));

    expect(pointerY).closeTo(0.8, 0.0001);
  });

  it('uses InputEvent acceptance to stop bubbling and report handled input', () => {
    const parent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const child = addControl(parent.item!, new AcceptingControl(player.engine), 10, 10, 40, 40);

    parent.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    const event = mouseButton(20, 20, true);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(event);
    expect(child.log).deep.equals(['down:10,10']);
    expect(parent.log).deep.equals([]);
    expect(event.isAccepted()).equals(true);
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.isInputHandled()).equals(true);

    event.clearAccepted();
    expect(event.isAccepted()).equals(false);
  });

  it('receives standardized EventSystem input and consumes accepted native events', () => {
    player.canvas.getBoundingClientRect = canvasRect;
    const control = addControl(
      composition.sceneRoot,
      new AcceptingControl(player.engine),
      0, 0, 100, 100,
    );
    let input: InputEvent | null = null;

    player.engine.eventSystem.on('input', event => {
      input = event;
    });
    const nativeEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 1,
    });

    player.canvas.dispatchEvent(nativeEvent);

    expect(input).instanceOf(InputEventMouseButton);
    expect(input!.isAccepted()).equals(true);
    expect(nativeEvent.defaultPrevented).equals(true);
    expect(control.log).deep.equals(['down:10,10']);
  });

  it('clears acceptance before EventSystem input dispatch', () => {
    const event = new InputEvent();
    let acceptedDuringDispatch = true;

    event.accept();
    player.engine.eventSystem.on('input', input => {
      acceptedDuringDispatch = input.isAccepted();
    });
    const handled = (player.engine.eventSystem as unknown as {
      pushInput: (input: InputEvent) => boolean,
    }).pushInput(event);

    expect(acceptedDuringDispatch).equals(false);
    expect(handled).equals(false);
  });

  it('emits canvas focus and blur events exactly once', () => {
    const focusEvents: string[] = [];

    player.engine.eventSystem.on('onCanvasFocus', () => focusEvents.push('in'));
    player.engine.eventSystem.on('onCanvasBlur', () => focusEvents.push('out'));

    player.canvas.dispatchEvent(new Event('focus'));
    player.canvas.dispatchEvent(new Event('blur'));
    expect(focusEvents).deep.equals(['in', 'out']);

    focusEvents.length = 0;
    player.engine.eventSystem.enabled = false;
    player.engine.eventSystem.bindListeners(null);
    expect(focusEvents).deep.equals([]);
  });

  it('releases mouse focus on canvas blur while preserving other GUI state', () => {
    const windowRoot = player.engine.root.getComponent(GUIRootComponent).windowRoot;
    const control = addControl(
      composition.sceneRoot,
      new CanvasBlurRecordingControl(player.engine),
      10, 0, 50, 50,
    );
    const sibling = addControl(
      composition.sceneRoot,
      new RecordingControl(player.engine),
      100, 0, 50, 50,
    );

    control.focusMode = FocusMode.Click;
    windowRoot.pushInput(mouseButton(20, 10, true, MouseButton.Left));
    windowRoot.pushInput(mouseButton(20, 10, true, MouseButton.Right));
    windowRoot.pushInput(mouseButton(20, 10, true, MouseButton.Middle));
    const touch = new InputEventScreenTouch();

    touch.index = 7;
    touch.pressed = true;
    touch.position.set(20, 10);
    windowRoot.pushInput(touch);

    player.canvas.dispatchEvent(new Event('blur'));

    expect(control.releases.map(event => ({
      button: event.buttonIndex,
      device: event.device,
      pressed: event.pressed,
      canceled: event.canceled,
      position: event.position,
      globalPosition: event.globalPosition,
    }))).deep.equals([
      {
        button: MouseButton.Left,
        device: InputEvent.deviceIdInternal,
        pressed: false,
        canceled: false,
        position: new Vector2(10, 10),
        globalPosition: new Vector2(10, 10),
      },
      {
        button: MouseButton.Right,
        device: InputEvent.deviceIdInternal,
        pressed: false,
        canceled: false,
        position: new Vector2(10, 10),
        globalPosition: new Vector2(10, 10),
      },
      {
        button: MouseButton.Middle,
        device: InputEvent.deviceIdInternal,
        pressed: false,
        canceled: false,
        position: new Vector2(10, 10),
        globalPosition: new Vector2(10, 10),
      },
    ]);
    expect(control.hasFocus()).equals(true);
    expect(control.mouseEnterCount).equals(1);
    expect(control.mouseLeaveCount).equals(0);
    expect(control.log).not.includes('blur');

    const key = new InputEventKey();

    key.pressed = true;
    key.keycode = 'Enter';
    windowRoot.pushInput(key);
    expect(control.log).includes('key:Enter');

    const drag = new InputEventScreenDrag();

    drag.index = 7;
    drag.position.set(110, 10);
    drag.relative.set(100, 0);
    windowRoot.pushInput(drag);
    expect(control.log).includes('touch-move:7:100,10');

    const motion = new InputEventMouseMotion();

    motion.position.set(110, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(100, 0);
    windowRoot.pushInput(motion);
    expect(sibling.log).deep.equals(['move:10,10']);
  });

  it('cancels only the affected native touch and its emulated mouse', () => {
    player.canvas.getBoundingClientRect = canvasRect;
    const inputs: InputEvent[] = [];

    player.engine.eventSystem.on('input', event => inputs.push(event));
    player.canvas.dispatchEvent(nativeTouchEvent('touchstart', [
      { identifier: 1, clientX: 20, clientY: 30 },
      { identifier: 2, clientX: 30, clientY: 40 },
    ]));

    inputs.length = 0;
    player.canvas.dispatchEvent(nativeTouchEvent('touchcancel', [
      { identifier: 1, clientX: 20, clientY: 30 },
    ]));

    const canceledTouches = inputs.filter(event => event instanceof InputEventScreenTouch);
    const canceledMouse = inputs.filter(event => event instanceof InputEventMouseButton);

    expect(canceledTouches).to.have.length(1);
    expect(canceledTouches[0]).includes({ index: 1, pressed: false, canceled: true });
    expect(canceledMouse).to.have.length(1);
    expect(canceledMouse[0]).includes({
      device: InputEvent.deviceIdEmulation,
      pressed: false,
      canceled: true,
    });

    inputs.length = 0;
    player.canvas.dispatchEvent(nativeTouchEvent('touchend', [
      { identifier: 2, clientX: 30, clientY: 40 },
    ]));
    const remainingTouchRelease = inputs.filter(event => event instanceof InputEventScreenTouch);

    expect(remainingTouchRelease).to.have.length(1);
    expect(remainingTouchRelease[0]).includes({ index: 2, pressed: false, canceled: false });
  });

  it('preserves dragging on blur and drops on a canceled mouse release', () => {
    addControl(composition.sceneRoot, new DragSourceControl(player.engine), 0, 0, 50, 50);
    const target = addControl(composition.sceneRoot, new DropTargetControl(player.engine), 100, 0, 50, 50);
    const windowRoot = player.engine.root.getComponent(GUIRootComponent).windowRoot;

    windowRoot.pushInput(mouseButton(10, 10, true));
    const motion = new InputEventMouseMotion();

    motion.position.set(110, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(100, 0);
    windowRoot.pushInput(motion);
    expect(windowRoot.guiIsDragging()).equals(true);
    expect(windowRoot.guiGetDragData()).equals('drag-data');

    player.canvas.dispatchEvent(new Event('blur'));
    expect(windowRoot.guiIsDragging()).equals(true);

    const release = mouseButton(110, 10, false);

    release.canceled = true;
    windowRoot.pushInput(release);
    expect(target.drops).deep.equals(['drag-data']);
    expect(windowRoot.guiIsDragging()).equals(false);
    expect(windowRoot.guiIsDragSuccessful()).equals(true);
  });

  it('keeps EventSystem disposal silent and lets GUIRootComponent clean up independently', () => {
    const guiRoot = player.engine.root.getComponent(GUIRootComponent);

    chai.spy.on(guiRoot.windowRoot, 'cancelPointerInput');
    player.engine.eventSystem.dispose();
    expect(guiRoot.windowRoot.cancelPointerInput).to.not.have.been.called();

    guiRoot.dispose();
    expect(guiRoot.windowRoot.cancelPointerInput).to.have.been.called.once;
  });

  it('uses reverse child order for hit testing', () => {
    const parent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const back = addControl(parent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);
    const front = addControl(parent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(mouseButton(10, 10, true));
    expect(front.log).deep.equals(['down:10,10']);
    expect(back.log).deep.equals([]);
  });

  it('defers mouse-over updates requested by enter callbacks until the next frame', () => {
    const back = addControl(composition.sceneRoot, new HoverRecordingControl(player.engine), 0, 0, 50, 50);
    const front = addControl(composition.sceneRoot, new SelfHidingControl(player.engine), 0, 0, 50, 50);
    const motion = new InputEventMouseMotion();

    motion.position.set(10, 10);
    motion.globalPosition.copyFrom(motion.position);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(motion);

    expect(front.log).deep.equals(['enter']);
    expect(back.log).not.includes('enter');

    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);
    expect(back.log).includes('enter');
  });

  it('routes keyboard input to the focused control', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);

    control.focusMode = FocusMode.Click;
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(mouseButton(10, 10, true));
    const key = new InputEventKey();

    key.pressed = true;
    key.keycode = 'Enter';
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(key);
    expect(control.log).deep.equals(['focus', 'down:10,10', 'key:Enter']);
    expect(control.hasFocus()).equals(true);
    expect(control.hasFocus(true)).equals(false);

    control.focus();
    expect(control.hasFocus(true)).equals(true);
  });

  it('keeps one focused control across all canvases in a window', () => {
    const first = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const overlayItem = new VFXItem(player.engine);

    overlayItem.addComponent(UICanvas);
    overlayItem.setParent(composition.root);
    const second = addControl(overlayItem, new RecordingControl(player.engine), 0, 0, 100, 100);

    first.focusMode = FocusMode.Click;
    second.focusMode = FocusMode.Click;
    first.focus();
    second.focus();
    expect(first.log).deep.equals(['focus', 'blur']);
    expect(second.log).deep.equals(['focus']);
    expect(first.root).equals(player.engine.root.getComponent(GUIRootComponent).windowRoot);
    expect(second.root).equals(player.engine.root.getComponent(GUIRootComponent).windowRoot);
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.guiGetFocusOwner()).equals(second);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.guiReleaseFocus();
    expect(second.log).deep.equals(['focus', 'blur']);
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.guiGetFocusOwner()).equals(null);
  });

  it('keeps pointer capture in the window GUIState across canvases', () => {
    const first = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 50, 50);
    const overlayItem = new VFXItem(player.engine);
    const overlay = overlayItem.addComponent(UICanvas);

    overlay.order = 10;
    overlayItem.setParent(composition.root);
    const second = addControl(overlayItem, new RecordingControl(player.engine), 100, 0, 50, 50);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(mouseButton(10, 10, true));
    const motion = new InputEventMouseMotion();

    motion.position.set(110, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(100, 0);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(motion);
    expect(first.log).deep.equals(['down:10,10', 'move:110,10']);
    expect(second.log).deep.equals([]);
  });

  it('keeps touch capture in the window GUIState across canvases', () => {
    const first = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 50, 50);
    const overlayItem = new VFXItem(player.engine);

    overlayItem.addComponent(UICanvas);
    overlayItem.setParent(composition.root);
    const second = addControl(overlayItem, new RecordingControl(player.engine), 100, 0, 50, 50);
    const touch = new InputEventScreenTouch();

    touch.index = 7;
    touch.pressed = true;
    touch.position.set(10, 10);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(touch);
    const drag = new InputEventScreenDrag();

    drag.index = 7;
    drag.position.set(110, 10);
    drag.relative.set(100, 0);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(drag);
    expect(first.log).deep.equals(['touch-down:7:10,10', 'touch-move:7:110,10']);
    expect(second.log).deep.equals([]);
  });

  it('clears descendant GUIState immediately when a parent hides or disables', () => {
    const parent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 50, 50);
    const child = addControl(parent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);
    const sibling = addControl(composition.sceneRoot, new RecordingControl(player.engine), 100, 0, 50, 50);

    child.focusMode = FocusMode.All;
    child.focus();
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(mouseButton(10, 10, true));
    const touch = new InputEventScreenTouch();

    touch.index = 7;
    touch.pressed = true;
    touch.position.set(10, 10);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(touch);

    parent.visible = false;
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.guiGetFocusOwner()).equals(null);
    parent.visible = true;

    const motion = new InputEventMouseMotion();

    motion.position.set(110, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(100, 0);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(motion);
    const drag = new InputEventScreenDrag();

    drag.index = 7;
    drag.position.set(110, 10);
    drag.relative.set(100, 0);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(drag);
    expect(sibling.log).deep.equals(['move:10,10', 'touch-move:7:10,10']);

    child.focus();
    parent.enabled = false;
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.guiGetFocusOwner()).equals(null);
    expect(child.log).deep.equals([
      'focus',
      'down:10,10',
      'touch-down:7:10,10',
      'blur',
      'focus',
      'blur',
    ]);
  });

  it('preserves GUIState when a Control moves within the same Root', () => {
    const firstParent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const secondParent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 100, 0, 100, 100);
    const child = addControl(firstParent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);

    child.focusMode = FocusMode.All;
    child.focus();
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(mouseButton(10, 10, true));
    const touch = new InputEventScreenTouch();

    touch.index = 9;
    touch.pressed = true;
    touch.position.set(10, 10);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(touch);

    child.item!.setParent(secondParent.item!);
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.guiGetFocusOwner()).equals(child);

    const key = new InputEventKey();

    key.pressed = true;
    key.keycode = 'Enter';
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(key);
    const motion = new InputEventMouseMotion();

    motion.position.set(260, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(250, 0);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(motion);
    const drag = new InputEventScreenDrag();

    drag.index = 9;
    drag.position.set(260, 10);
    drag.relative.set(250, 0);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(drag);
    expect(child.log).deep.equals([
      'focus',
      'down:10,10',
      'touch-down:9:10,10',
      'key:Enter',
      'move:160,10',
      'touch-move:9:160,10',
    ]);
  });

  it('clears only the disabled canvas state from the window GUIState', () => {
    const overlayItem = new VFXItem(player.engine);
    const overlay = overlayItem.addComponent(UICanvas);

    overlayItem.setParent(composition.root);
    const control = addControl(overlayItem, new RecordingControl(player.engine), 0, 0, 50, 50);

    control.focusMode = FocusMode.Click;
    control.focus();
    overlay.enabled = false;
    expect(control.log).deep.equals(['focus', 'blur']);
    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.guiGetFocusOwner()).equals(null);
  });

  it('stops receiving input when its canvas disables events', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);

    composition.sceneRoot.getComponent(UICanvas).receivesEvents = false;
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(mouseButton(10, 10, true));
    expect(control.log).deep.equals([]);
  });

  it('stores mouse position on the window and derives local control coordinates', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 10, 20, 50, 50);
    const motion = new InputEventMouseMotion();

    motion.position.set(35, 55);
    motion.globalPosition.copyFrom(motion.position);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(motion);

    expect(player.engine.root.getComponent(GUIRootComponent).windowRoot.getMousePosition()).deep.equals(new Vector2(35, 55));
    expect(control.getLocalMousePosition()).deep.equals(new Vector2(25, 35));
    expect('getMousePosition' in composition.sceneRoot.getComponent(UICanvas).rootControl).equals(false);
  });

  it('supports custom CSS cursors and refreshes cursor changes immediately', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const motion = new InputEventMouseMotion();

    control.defaultCursorShape = CursorShape.PointingHand;
    motion.position.set(10, 10);
    motion.globalPosition.copyFrom(motion.position);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.pushInput(motion);
    expect(player.canvas.style.cursor).equals('pointer');

    control.defaultCursorShape = 'grabbing';
    expect(player.canvas.style.cursor).equals('grabbing');
  });
});

function addControl<T extends Control> (
  parent: VFXItem,
  control: T,
  x: number,
  y: number,
  width: number,
  height: number,
): T {
  const item = new VFXItem(parent.engine);
  const bridge = item.addComponent(UIControl);

  bridge.control = control;
  item.setParent(parent);
  control.setPosition(x, y);
  control.setSize(width, height);

  return control;
}

function mouseButton (
  x: number,
  y: number,
  pressed: boolean,
  button = MouseButton.Left,
): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.buttonIndex = button;
  event.pressed = pressed;
  event.position.copyFrom(new Vector2(x, y));
  event.globalPosition.copyFrom(event.position);

  return event;
}

function nativeTouchEvent (
  type: 'touchstart' | 'touchend' | 'touchcancel',
  changedTouches: Array<{ identifier: number, clientX: number, clientY: number }>,
): Event {
  const event = new Event(type, { cancelable: true });

  Object.defineProperty(event, 'changedTouches', { value: changedTouches });

  return event;
}

function canvasRect (): DOMRect {
  return {
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    right: 210,
    bottom: 120,
    width: 200,
    height: 100,
    toJSON: () => ({}),
  };
}
