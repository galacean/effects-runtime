import {
  Composition,
  Control,
  CursorShape,
  FocusMode,
  InputEvent,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
  Player,
  UIControl,
  UICanvas,
  VFXItem,
  math,
} from '@galacean/effects';

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

describe('core/gui input', () => {
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

    player.engine.windowRoot.pushInput(event);
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

    player.engine.windowRoot.pushInput(event);
    expect(child.log).deep.equals(['down:10,10']);
    expect(parent.log).deep.equals([]);
    expect(event.isAccepted()).equals(true);
    expect(player.engine.windowRoot.isInputHandled()).equals(true);

    event.clearAccepted();
    expect(event.isAccepted()).equals(false);
  });

  it('uses reverse child order for hit testing', () => {
    const parent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const back = addControl(parent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);
    const front = addControl(parent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);

    player.engine.windowRoot.pushInput(mouseButton(10, 10, true));
    expect(front.log).deep.equals(['down:10,10']);
    expect(back.log).deep.equals([]);
  });

  it('defers mouse-over updates requested by enter callbacks until the next frame', () => {
    const back = addControl(composition.sceneRoot, new HoverRecordingControl(player.engine), 0, 0, 50, 50);
    const front = addControl(composition.sceneRoot, new SelfHidingControl(player.engine), 0, 0, 50, 50);
    const motion = new InputEventMouseMotion();

    motion.position.set(10, 10);
    motion.globalPosition.copyFrom(motion.position);
    player.engine.windowRoot.pushInput(motion);

    expect(front.log).deep.equals(['enter']);
    expect(back.log).not.includes('enter');

    player.engine.windowRoot.update(0);
    expect(back.log).includes('enter');
  });

  it('routes keyboard input to the focused control', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);

    control.focusMode = FocusMode.Click;
    player.engine.windowRoot.pushInput(mouseButton(10, 10, true));
    const key = new InputEventKey();

    key.pressed = true;
    key.keycode = 'Enter';
    player.engine.windowRoot.pushInput(key);
    expect(control.log).deep.equals(['focus', 'down:10,10', 'key:Enter']);
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
    expect(first.root).equals(player.engine.windowRoot);
    expect(second.root).equals(player.engine.windowRoot);
    expect(player.engine.windowRoot.guiGetFocusOwner()).equals(second);

    player.engine.windowRoot.guiReleaseFocus();
    expect(second.log).deep.equals(['focus', 'blur']);
    expect(player.engine.windowRoot.guiGetFocusOwner()).equals(null);
  });

  it('keeps pointer capture in the window GUIState across canvases', () => {
    const first = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 50, 50);
    const overlayItem = new VFXItem(player.engine);
    const overlay = overlayItem.addComponent(UICanvas);

    overlay.order = 10;
    overlayItem.setParent(composition.root);
    const second = addControl(overlayItem, new RecordingControl(player.engine), 100, 0, 50, 50);

    player.engine.windowRoot.pushInput(mouseButton(10, 10, true));
    const motion = new InputEventMouseMotion();

    motion.position.set(110, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(100, 0);
    player.engine.windowRoot.pushInput(motion);
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
    player.engine.windowRoot.pushInput(touch);
    const drag = new InputEventScreenDrag();

    drag.index = 7;
    drag.position.set(110, 10);
    drag.relative.set(100, 0);
    player.engine.windowRoot.pushInput(drag);
    expect(first.log).deep.equals(['touch-down:7:10,10', 'touch-move:7:110,10']);
    expect(second.log).deep.equals([]);
  });

  it('clears descendant GUIState immediately when a parent hides or disables', () => {
    const parent = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 50, 50);
    const child = addControl(parent.item!, new RecordingControl(player.engine), 0, 0, 50, 50);
    const sibling = addControl(composition.sceneRoot, new RecordingControl(player.engine), 100, 0, 50, 50);

    child.focusMode = FocusMode.All;
    child.focus();
    player.engine.windowRoot.pushInput(mouseButton(10, 10, true));
    const touch = new InputEventScreenTouch();

    touch.index = 7;
    touch.pressed = true;
    touch.position.set(10, 10);
    player.engine.windowRoot.pushInput(touch);

    parent.visible = false;
    expect(player.engine.windowRoot.guiGetFocusOwner()).equals(null);
    parent.visible = true;

    const motion = new InputEventMouseMotion();

    motion.position.set(110, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(100, 0);
    player.engine.windowRoot.pushInput(motion);
    const drag = new InputEventScreenDrag();

    drag.index = 7;
    drag.position.set(110, 10);
    drag.relative.set(100, 0);
    player.engine.windowRoot.pushInput(drag);
    expect(sibling.log).deep.equals(['move:10,10', 'touch-move:7:10,10']);

    child.focus();
    parent.enabled = false;
    expect(player.engine.windowRoot.guiGetFocusOwner()).equals(null);
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
    player.engine.windowRoot.pushInput(mouseButton(10, 10, true));
    const touch = new InputEventScreenTouch();

    touch.index = 9;
    touch.pressed = true;
    touch.position.set(10, 10);
    player.engine.windowRoot.pushInput(touch);

    child.item!.setParent(secondParent.item!);
    expect(player.engine.windowRoot.guiGetFocusOwner()).equals(child);

    const key = new InputEventKey();

    key.pressed = true;
    key.keycode = 'Enter';
    player.engine.windowRoot.pushInput(key);
    const motion = new InputEventMouseMotion();

    motion.position.set(260, 10);
    motion.globalPosition.copyFrom(motion.position);
    motion.relative.set(250, 0);
    player.engine.windowRoot.pushInput(motion);
    const drag = new InputEventScreenDrag();

    drag.index = 9;
    drag.position.set(260, 10);
    drag.relative.set(250, 0);
    player.engine.windowRoot.pushInput(drag);
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
    expect(player.engine.windowRoot.guiGetFocusOwner()).equals(null);
  });

  it('stops receiving input when its canvas disables events', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);

    composition.uiCanvas.receivesEvents = false;
    player.engine.windowRoot.pushInput(mouseButton(10, 10, true));
    expect(control.log).deep.equals([]);
  });

  it('stores mouse position on the window and derives local control coordinates', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 10, 20, 50, 50);
    const motion = new InputEventMouseMotion();

    motion.position.set(35, 55);
    motion.globalPosition.copyFrom(motion.position);
    player.engine.windowRoot.pushInput(motion);

    expect(player.engine.windowRoot.getMousePosition()).deep.equals(new Vector2(35, 55));
    expect(control.getLocalMousePosition()).deep.equals(new Vector2(25, 35));
    expect('getMousePosition' in composition.uiCanvas.rootControl).equals(false);
  });

  it('supports custom CSS cursors and refreshes cursor changes immediately', () => {
    const control = addControl(composition.sceneRoot, new RecordingControl(player.engine), 0, 0, 100, 100);
    const motion = new InputEventMouseMotion();

    control.defaultCursorShape = CursorShape.PointingHand;
    motion.position.set(10, 10);
    motion.globalPosition.copyFrom(motion.position);
    player.engine.windowRoot.pushInput(motion);
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

function mouseButton (x: number, y: number, pressed: boolean): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.buttonIndex = MouseButton.Left;
  event.pressed = pressed;
  event.position.copyFrom(new Vector2(x, y));
  event.globalPosition.copyFrom(event.position);

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
