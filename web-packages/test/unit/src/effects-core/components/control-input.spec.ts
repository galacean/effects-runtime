import type {
  CanvasLayer,
  Composition,
  Engine,
  VFXItem,
  Viewport,
} from '@galacean/effects';
import {
  CanvasItem,
  Control,
  CursorShape,
  EVENT_TYPE_CLICK,
  EVENT_TYPE_TOUCH_END,
  EVENT_TYPE_TOUCH_START,
  EventSystem,
  FocusMode,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  KeyLocation,
  MouseButton,
  MouseBehaviorRecursive,
  MouseFilter,
  RectTransform,
  SubViewport,
  Window,
  math,
} from '@galacean/effects';

const { Matrix3, Vector2 } = math;

type Vector2 = math.Vector2;

const { expect } = chai;

type TestEnvironment = {
  engine: Engine,
  viewport: Viewport,
  composition: Composition,
  layer: CanvasLayer,
};

class InputControl extends Control {
  readonly inputLog: string[] = [];
  dragValue: unknown = null;
  allowDrop = false;
  droppedValue: unknown = null;
  mouseDownCallback?: (
    location: Vector2,
    button: MouseButton,
    event: InputEventMouseButton,
  ) => void;
  mouseUpCallback?: (
    location: Vector2,
    button: MouseButton,
    event: InputEventMouseButton,
  ) => void;
  mouseMoveCallback?: (location: Vector2, event: InputEventMouseMotion) => void;
  mouseEnterCallback?: (location: Vector2) => void;
  mouseLeaveCallback?: () => void;
  mouseWheelCallback?: (
    location: Vector2,
    delta: number,
    event: InputEventMouseButton,
  ) => void;
  touchDownCallback?: (
    location: Vector2,
    pointerId: number,
    event: InputEventScreenTouch,
  ) => void;
  gotFocusCallback?: () => void;
  keyDownCallback?: (event: InputEventKey) => void;
  keyUpCallback?: (event: InputEventKey) => void;
  dragPosition: Vector2 | null = null;

  constructor (engine: Engine, readonly label: string) {
    super(engine);
  }

  override onMouseDown (
    location: Vector2,
    button: MouseButton,
    event: InputEventMouseButton,
  ): void {
    this.inputLog.push(`${this.label}:down:${location.x},${location.y}`);
    this.mouseDownCallback?.(location, button, event);
  }

  override onMouseUp (
    location: Vector2,
    button: MouseButton,
    event: InputEventMouseButton,
  ): void {
    this.inputLog.push(`${this.label}:up:${location.x},${location.y}`);
    this.mouseUpCallback?.(location, button, event);
  }

  override onMouseMove (location: Vector2, event: InputEventMouseMotion): void {
    this.inputLog.push(`${this.label}:move:${location.x},${location.y}`);
    this.mouseMoveCallback?.(location, event);
  }

  override onMouseEnter (location: Vector2): void {
    this.mouseEnterCallback?.(location);
  }

  override onMouseLeave (): void {
    this.mouseLeaveCallback?.();
  }

  override onMouseWheel (
    location: Vector2,
    delta: number,
    event: InputEventMouseButton,
  ): void {
    this.inputLog.push(`${this.label}:wheel:${location.x},${location.y}`);
    this.mouseWheelCallback?.(location, delta, event);
  }

  override onTouchDown (
    location: Vector2,
    pointerId: number,
    event: InputEventScreenTouch,
  ): void {
    this.inputLog.push(`${this.label}:touch-down:${location.x},${location.y}`);
    this.touchDownCallback?.(location, pointerId, event);
  }

  override onTouchMove (location: Vector2, pointerId: number): void {
    this.inputLog.push(`${this.label}:touch-move:${location.x},${location.y}`);
  }

  override onTouchUp (location: Vector2, pointerId: number): void {
    this.inputLog.push(`${this.label}:touch-up:${location.x},${location.y}`);
  }

  override onGotFocus (): void {
    this.gotFocusCallback?.();
  }

  override onKeyDown (event: InputEventKey): void {
    this.inputLog.push(`${this.label}:key-down:${event.keycode}`);
    this.keyDownCallback?.(event);
  }

  override onKeyUp (event: InputEventKey): void {
    this.inputLog.push(`${this.label}:key-up:${event.keycode}`);
    this.keyUpCallback?.(event);
  }

  protected override getDragData (position: Vector2): unknown {
    this.dragPosition = position.clone();

    return this.dragValue;
  }

  protected override canDropData (position: Vector2, data: unknown): boolean {
    return this.allowDrop;
  }

  protected override dropData (position: Vector2, data: unknown): void {
    this.droppedValue = data;
  }
}

describe('core/components/control-input', () => {
  it('transforms local mouse fields and preserves global fields', () => {
    const event = new InputEventMouseMotion();

    event.position.set(2, 3);
    event.globalPosition.set(30, 40);
    event.relative.set(1, 2);
    event.screenRelative.set(5, 6);
    event.velocity.set(7, 8);
    event.screenVelocity.set(9, 10);

    const transform = new Matrix3(2, 0, 0, 0, 3, 0, 10, 20, 1);
    const transformed = event.xformedBy(transform);

    expect(transformed.position.toArray()).deep.equals([14, 29]);
    expect(transformed.globalPosition.toArray()).deep.equals([30, 40]);
    expect(transformed.relative.toArray()).deep.equals([2, 6]);
    expect(transformed.velocity.toArray()).deep.equals([14, 24]);
    expect(transformed.screenRelative.toArray()).deep.equals([5, 6]);
    expect(transformed.screenVelocity.toArray()).deep.equals([9, 10]);
  });

  it('copies key fields and keeps canceled events separate from releases', () => {
    const event = new InputEventKey();

    event.device = InputEventKey.deviceIdKeyboard;
    event.pressed = true;
    event.keycode = 'a';
    event.physicalKeycode = 'KeyA';
    event.keyLabel = 'a';
    event.unicode = 97;
    event.location = KeyLocation.Left;
    event.echo = true;
    event.ctrlPressed = true;

    const transformed = event.xformedBy(new Matrix3());

    expect(transformed.device).equals(InputEventKey.deviceIdKeyboard);
    expect(transformed.keycode).equals('a');
    expect(transformed.physicalKeycode).equals('KeyA');
    expect(transformed.keyLabel).equals('a');
    expect(transformed.unicode).equals(97);
    expect(transformed.location).equals(KeyLocation.Left);
    expect(transformed.ctrlPressed).equals(true);
    expect(transformed.isPressed()).equals(true);
    expect(transformed.isEcho()).equals(true);

    transformed.canceled = true;
    expect(transformed.isPressed()).equals(false);
    expect(transformed.isReleased()).equals(false);
    expect(transformed.isCanceled()).equals(true);
  });

  it('finds the last drawn deepest control and respects clipping', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const first = createControl(environment, 'first', 30, 30, root, 10, 10);
    const second = createControl(environment, 'second', 30, 30, root, 10, 10);

    expect(environment.viewport.guiFindControl(new Vector2(20, 20))).equals(second);

    root.clipContents = true;
    second.transform.setPosition(120, 0, 0);
    first.transform.setPosition(120, 0, 0);
    expect(environment.viewport.guiFindControl(new Vector2(125, 5))).equals(null);

    root.clipContents = false;
    expect(environment.viewport.guiFindControl(new Vector2(125, 5))).equals(second);

    root.transform.setScale(0, 1, 1);
    expect(environment.viewport.guiFindControl(new Vector2(0, 5))).equals(null);
  });

  it('localizes individual mouse callbacks while bubbling', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 40, 40, root, 10, 10);
    const order: string[] = [];

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    root.mouseDownCallback = location => order.push(`root:${location.x},${location.y}`);
    child.mouseDownCallback = location => order.push(`child:${location.x},${location.y}`);

    environment.viewport.pushInput(mouseButton(20, 20, true));

    expect(order).deep.equals([
      'child:10,10',
      'root:20,20',
    ]);
  });

  it('keeps mouse down delivery for repeated clicks without movement', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const secondPress = mouseButton(20, 20, true);
    let doubleClick = false;

    target.mouseDownCallback = (...parameters) => {
      doubleClick = parameters[2].doubleClick;
    };
    secondPress.doubleClick = true;
    environment.viewport.pushInput(secondPress);

    expect(target.inputLog).deep.equals(['target:down:20,20']);
    expect(doubleClick).equals(true);
  });

  it('uses acceptEvent to stop bubbling', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 40, 40, root, 10, 10);

    child.mouseFilter = MouseFilter.Pass;
    child.mouseDownCallback = () => child.acceptEvent();
    environment.viewport.pushInput(mouseButton(20, 20, true));

    expect(child.inputLog).deep.equals(['child:down:10,10']);
    expect(root.inputLog).deep.equals([]);
    expect(environment.viewport.isInputHandled()).equals(true);
  });

  it('ignores acceptEvent before a control enters the canvas tree', () => {
    const environment = createEnvironment();
    const detached = new InputControl(environment.engine, 'detached');

    detached.acceptEvent();
    expect(environment.viewport.isInputHandled()).equals(false);
  });

  it('re-reads the mouse filter after each callback', () => {
    const passEnvironment = createEnvironment();
    const passRoot = createControl(passEnvironment, 'root', 100, 100);
    const passChild = createControl(passEnvironment, 'child', 40, 40, passRoot, 10, 10);

    passRoot.mouseFilter = MouseFilter.Pass;
    passChild.mouseDownCallback = () => {
      passChild.mouseFilter = MouseFilter.Pass;
    };
    passEnvironment.viewport.pushInput(mouseButton(20, 20, true));
    expect(passChild.inputLog).deep.equals(['child:down:10,10']);
    expect(passRoot.inputLog).deep.equals(['root:down:20,20']);
    expect(passEnvironment.viewport.isInputHandled()).equals(false);

    const stopEnvironment = createEnvironment();
    const stopRoot = createControl(stopEnvironment, 'root', 100, 100);
    const stopChild = createControl(stopEnvironment, 'child', 40, 40, stopRoot, 10, 10);

    stopRoot.mouseFilter = MouseFilter.Pass;
    stopChild.mouseFilter = MouseFilter.Pass;
    stopChild.mouseDownCallback = () => {
      stopChild.mouseFilter = MouseFilter.Stop;
    };
    stopEnvironment.viewport.pushInput(mouseButton(20, 20, true));
    expect(stopChild.inputLog).deep.equals(['child:down:10,10']);
    expect(stopRoot.inputLog).deep.equals([]);
    expect(stopEnvironment.viewport.isInputHandled()).equals(true);
  });

  it('keeps stop pass and ignore hit and propagation behavior distinct', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const back = createControl(environment, 'back', 40, 40, root, 10, 10);
    const front = createControl(environment, 'front', 40, 40, root, 10, 10);

    root.mouseFilter = MouseFilter.Pass;
    back.mouseFilter = MouseFilter.Pass;
    front.mouseFilter = MouseFilter.Ignore;
    environment.viewport.pushInput(mouseButton(20, 20, true));
    expect(back.inputLog).deep.equals(['back:down:10,10']);
    expect(front.inputLog).deep.equals([]);

    environment.viewport.pushInput(mouseButton(20, 20, false));
    back.inputLog.length = 0;
    root.inputLog.length = 0;
    front.mouseFilter = MouseFilter.Pass;
    environment.viewport.pushInput(mouseButton(20, 20, true));
    expect(front.inputLog).deep.equals(['front:down:10,10']);
    expect(back.inputLog).deep.equals([]);
    expect(root.inputLog).deep.equals(['root:down:20,20']);
    expect(environment.viewport.isInputHandled()).equals(false);

    environment.viewport.pushInput(mouseButton(20, 20, false));
    root.inputLog.length = 0;
    front.inputLog.length = 0;
    front.mouseFilter = MouseFilter.Stop;
    environment.viewport.pushInput(mouseButton(20, 20, true));
    expect(front.inputLog).deep.equals(['front:down:10,10']);
    expect(root.inputLog).deep.equals([]);
    expect(environment.viewport.isInputHandled()).equals(true);
  });

  it('passes the complete localized event to individual callbacks', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 40, 40, root, 10, 10);
    let received: InputEventMouseMotion | null = null;

    child.mouseFilter = MouseFilter.Pass;
    child.mouseMoveCallback = (location, event) => {
      received = event;
      child.acceptEvent();
    };
    const motion = mouseMotion(20, 20, 2, 3);

    motion.shiftPressed = true;
    motion.globalPosition.set(20, 20);
    environment.viewport.pushInput(motion);
    expect(received).not.equals(null);
    expect(received!.position.toArray()).deep.equals([10, 10]);
    expect(received!.globalPosition.toArray()).deep.equals([20, 20]);
    expect(received!.relative.toArray()).deep.equals([2, 3]);
    expect(received!.shiftPressed).equals(true);
    expect(root.inputLog).deep.equals([]);
    expect(environment.viewport.isInputHandled()).equals(true);
  });

  it('keeps captured mouse input separate from the hover hierarchy', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 40, 40, root, 10, 10);
    const hoverLog: string[] = [];

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    root.mouseEnterCallback = () => hoverLog.push('root-enter');
    root.mouseLeaveCallback = () => hoverLog.push('root-exit');
    child.mouseEnterCallback = () => hoverLog.push('child-enter');
    child.mouseLeaveCallback = () => hoverLog.push('child-exit');

    environment.viewport.pushInput(mouseButton(20, 20, true));
    environment.viewport.pushInput(mouseMotion(150, 150, 130, 130));

    expect(hoverLog).deep.equals(['root-enter', 'child-enter', 'child-exit', 'root-exit']);
    expect(child.inputLog[1]).equals('child:move:140,140');

    environment.viewport.pushInput(mouseButton(150, 150, false));
    environment.viewport.pushInput(mouseMotion(150, 150, 0, 0));
    expect(child.inputLog.length).equals(3);
  });

  it('keeps mouse focus when the captured control becomes ignored', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 200, 100);
    const child = createControl(environment, 'child', 40, 40, root, 10, 10);

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    environment.viewport.pushInput(mouseButton(20, 20, true));

    child.mouseFilter = MouseFilter.Ignore;
    environment.viewport.pushInput(mouseMotion(150, 50, 130, 30));
    environment.viewport.pushInput(mouseButton(150, 50, false));

    expect(child.inputLog).deep.equals(['child:down:10,10']);
    expect(root.inputLog).deep.equals([
      'root:down:20,20',
      'root:move:150,50',
      'root:up:150,50',
    ]);
  });

  it('assigns click focus and completes a drag drop', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const focusLog: string[] = [];

    target.focusMode = FocusMode.Click;
    target.dragValue = { id: 7 };
    target.allowDrop = true;
    target.gotFocusCallback = () => focusLog.push('enter');

    environment.viewport.pushInput(mouseButton(10, 10, true));
    expect(environment.viewport.guiGetFocusOwner()).equals(target);
    expect(focusLog).deep.equals(['enter']);

    environment.viewport.pushInput(mouseMotion(30, 10, 20, 0));
    expect(environment.viewport.guiIsDragging()).equals(true);
    expect(environment.viewport.guiGetDragData()).deep.equals({ id: 7 });

    environment.viewport.pushInput(mouseButton(30, 10, false));
    expect(environment.viewport.guiIsDragging()).equals(false);
    expect(environment.viewport.guiIsDragSuccessful()).equals(true);
    expect(target.droppedValue).deep.equals({ id: 7 });
  });

  it('does not assign click focus to an ignored ancestor outside the hover hierarchy', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 50, 50, root);

    root.mouseFilter = MouseFilter.Ignore;
    root.focusMode = FocusMode.Click;
    child.mouseFilter = MouseFilter.Pass;
    environment.viewport.pushInput(mouseButton(10, 10, true));
    expect(environment.viewport.guiGetFocusOwner()).equals(null);
  });

  it('uses net drag displacement and queries ignored ancestors for drag data and drop', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 80, 80, root);

    root.mouseFilter = MouseFilter.Ignore;
    root.dragValue = { id: 9 };
    root.allowDrop = true;
    child.mouseFilter = MouseFilter.Pass;

    environment.viewport.pushInput(mouseButton(10, 10, true));
    environment.viewport.pushInput(mouseMotion(16, 10, 6, 0));
    environment.viewport.pushInput(mouseMotion(10, 10, -6, 0));
    expect(environment.viewport.guiIsDragging()).equals(false);
    expect(root.dragPosition).equals(null);

    environment.viewport.pushInput(mouseMotion(21, 10, 11, 0));
    expect(environment.viewport.guiIsDragging()).equals(true);
    expect(root.dragPosition!.toArray()).deep.equals([10, 10]);

    environment.viewport.pushInput(mouseButton(21, 10, false));
    expect(environment.viewport.guiIsDragSuccessful()).equals(true);
    expect(root.droppedValue).deep.equals({ id: 9 });
    expect(environment.viewport.isInputHandled()).equals(false);
  });

  it('uses canvas CSS pixels when adapting native mouse input', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 200, 100);
    const positions: number[][] = [];
    const canvas = environment.engine.canvas;

    canvas.width = 400;
    canvas.height = 200;
    canvas.getBoundingClientRect = () => ({
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
    target.mouseDownCallback = location => positions.push(location.toArray());
    target.mouseUpCallback = location => positions.push(location.toArray());

    const eventSystem = new EventSystem(environment.engine);

    eventSystem.bindListeners(canvas);
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 60,
      clientY: 90,
    }));
    window.dispatchEvent(new MouseEvent('mouseup', {
      button: 0,
      buttons: 0,
      clientX: 60,
      clientY: 90,
    }));

    expect(positions).deep.equals([[50, 30], [50, 30]]);
    eventSystem.dispose();
  });

  it('runs event listeners and scene picking only after control input remains unhandled', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const canvas = environment.engine.canvas;
    const order: string[] = [];
    const eventSystem = new EventSystem(environment.engine);

    environment.composition.hitTest = () => {
      order.push('pick');

      return [];
    };
    eventSystem.addEventListener(EVENT_TYPE_TOUCH_START, () => order.push('listener'));
    eventSystem.bindListeners(canvas);

    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 90,
    }));
    expect(order).deep.equals([]);

    window.dispatchEvent(new MouseEvent('mouseup', {
      button: 0,
      clientX: 10,
      clientY: 90,
    }));
    target.mouseFilter = MouseFilter.Pass;
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 90,
    }));
    expect(order).deep.equals(['listener', 'pick']);
    eventSystem.dispose();
  });

  it('adapts native key events and consumes only accepted input', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const canvas = environment.engine.canvas;
    let received: InputEventKey | null = null;

    target.focusMode = FocusMode.All;
    target.grabFocus();
    target.keyDownCallback = event => {
      received = event;
      target.acceptEvent();
    };

    const eventSystem = new EventSystem(environment.engine);

    eventSystem.bindListeners(canvas);
    const keyDown = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      code: 'KeyA',
      location: 1,
      repeat: true,
      ctrlKey: true,
    });

    canvas.dispatchEvent(keyDown);
    expect(received).not.equals(null);
    expect(received!.keycode).equals('a');
    expect(received!.physicalKeycode).equals('KeyA');
    expect(received!.unicode).equals(97);
    expect(received!.location).equals(KeyLocation.Left);
    expect(received!.isEcho()).equals(true);
    expect(received!.ctrlPressed).equals(true);
    expect(keyDown.defaultPrevented).equals(true);
    expect(canvas.tabIndex).equals(0);
    expect(canvas.style.outline).equals('none');

    const keyUp = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      code: 'KeyA',
    });

    canvas.dispatchEvent(keyUp);
    expect(target.inputLog[target.inputLog.length - 1]).equals('target:key-up:a');
    expect(keyUp.defaultPrevented).equals(false);
    eventSystem.dispose();
    expect(canvas.hasAttribute('tabindex')).equals(false);
    expect(canvas.style.outline).equals('');
  });

  it('prevents browser mouse synthesis and emits one controlled mouse event from touch', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const canvas = environment.engine.canvas;
    const devices: number[] = [];
    const eventNotifications: string[] = [];

    target.mouseFilter = MouseFilter.Pass;
    target.mouseDownCallback = (location, button, event) => devices.push(event.device);
    target.touchDownCallback = (location, pointerId, event) => devices.push(event.device);

    const eventSystem = new EventSystem(environment.engine);

    eventSystem.addEventListener(EVENT_TYPE_TOUCH_START, () => eventNotifications.push('start'));
    eventSystem.addEventListener(EVENT_TYPE_CLICK, () => eventNotifications.push('click'));
    eventSystem.addEventListener(EVENT_TYPE_TOUCH_END, () => eventNotifications.push('end'));
    eventSystem.bindListeners(canvas);

    const touchStart = createTouchEvent('touchstart', 7, 10, 90);

    canvas.dispatchEvent(touchStart);
    expect(touchStart.defaultPrevented).equals(true);
    expect(target.inputLog).deep.equals([
      'target:down:10,10',
      'target:touch-down:10,10',
    ]);
    expect(devices).deep.equals([InputEventMouseButton.deviceIdEmulation, 0]);
    expect(eventNotifications).deep.equals(['start']);

    canvas.dispatchEvent(createTouchEvent('touchstart', 8, 20, 80));
    expect(target.inputLog[target.inputLog.length - 1]).equals('target:touch-down:20,20');
    expect(devices).deep.equals([InputEventMouseButton.deviceIdEmulation, 0, 0]);
    expect(eventNotifications).deep.equals(['start', 'start']);

    const touchEnd = createTouchEvent('touchend', 7, 10, 90);

    canvas.dispatchEvent(touchEnd);
    expect(touchEnd.defaultPrevented).equals(true);
    expect(target.inputLog.slice(-2)).deep.equals([
      'target:up:10,10',
      'target:touch-up:10,10',
    ]);
    expect(eventNotifications).deep.equals(['start', 'start', 'click', 'end']);
    eventSystem.dispose();
  });

  it('orders roots globally by canvas layer inside a viewport', () => {
    const environment = createEnvironment();
    const base = createControl(environment, 'base', 100, 100);
    const upperLayer = { layer: 10, canvasItems: [] } as unknown as CanvasLayer;
    const upperLayerEnvironment = { ...environment, layer: upperLayer };

    environment.viewport.canvasLayers.push(upperLayer);

    const upper = createControl(upperLayerEnvironment, 'upper', 100, 100);

    expect(environment.viewport.guiFindControl(new Vector2(10, 10))).equals(upper);

    const frontLayer = { layer: -10, canvasItems: [] } as unknown as CanvasLayer;
    const frontEnvironment = {
      ...environment,
      layer: frontLayer,
    };

    environment.viewport.canvasLayers.push(frontLayer);

    const front = createControl(frontEnvironment, 'front', 100, 100);

    expect(environment.viewport.guiFindControl(new Vector2(10, 10))).equals(upper);
    expect(base).not.equals(upper);
    expect(front).not.equals(upper);
  });

  it('routes engine viewport input to the frontmost isolated viewport', () => {
    const environment = createEnvironment();
    const base = createControl(environment, 'base', 100, 100);
    const childViewport = new SubViewport(environment.engine);
    const childLayer = { layer: 0, canvasItems: [] } as unknown as CanvasLayer;
    const childComposition = {
      engine: environment.engine,
      interactive: true,
      viewport: childViewport,
      getIndex: () => 1,
      hitTest: () => [],
    } as unknown as Composition;
    const childViewportItem = {
      composition: childComposition,
      isInsideTree: true,
      parent: null,
      components: [childViewport],
      beginViewportChange: () => false,
      endViewportChange: () => { },
    } as unknown as VFXItem;
    const childEnvironment = {
      ...environment,
      viewport: childViewport,
      composition: childComposition,
      layer: childLayer,
    };

    childViewport.item = childViewportItem;
    environment.engine.compositions.push(childComposition);
    childViewport.canvasLayers.push(childLayer);
    const front = createControl(childEnvironment, 'front', 100, 100);

    environment.engine.viewport.pushInput(mouseButton(10, 10, true));
    expect(front.inputLog).deep.equals(['front:down:10,10']);
    expect(base.inputLog).deep.equals([]);

    front.dragValue = { source: 'child' };
    front.allowDrop = true;
    environment.engine.viewport.pushInput(mouseMotion(30, 10, 20, 0));
    expect(childViewport.guiIsDragging()).equals(true);
    expect(childViewport.guiGetDragData()).deep.equals({ source: 'child' });
    expect(environment.engine.viewport.guiIsDragging()).equals(false);
    expect(environment.engine.viewport.guiGetDragData()).equals(null);

    environment.engine.viewport.pushInput(mouseButton(10, 10, false));
    expect(childViewport.guiIsDragSuccessful()).equals(true);
    expect(environment.engine.viewport.guiIsDragSuccessful()).equals(false);
    front.enabled = false;
    environment.engine.viewport.pushInput(mouseButton(10, 10, true));
    expect(base.inputLog).deep.equals(['base:down:10,10']);

    childViewport.dispose();
  });

  it('applies recursive mouse overrides and forced wheel passing', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 80, 80, root);
    const leaf = createControl(environment, 'leaf', 40, 40, child);
    const wheelOrder: string[] = [];

    root.mouseBehaviorRecursive = MouseBehaviorRecursive.Disabled;
    expect(environment.viewport.guiFindControl(new Vector2(10, 10))).equals(null);

    child.mouseBehaviorRecursive = MouseBehaviorRecursive.Enabled;
    expect(environment.viewport.guiFindControl(new Vector2(10, 10))).equals(leaf);

    leaf.mouseWheelCallback = () => wheelOrder.push('leaf');
    child.mouseWheelCallback = () => wheelOrder.push('child');
    root.mouseWheelCallback = () => wheelOrder.push('root');
    root.mouseBehaviorRecursive = MouseBehaviorRecursive.Enabled;
    root.mouseForcePassScrollEvents = false;
    environment.viewport.pushInput(wheelButton(10, 10));
    expect(wheelOrder).deep.equals(['leaf', 'child', 'root']);
    expect(environment.viewport.isInputHandled()).equals(true);

    wheelOrder.length = 0;
    root.mouseForcePassScrollEvents = true;
    environment.viewport.pushInput(wheelButton(10, 10));
    expect(wheelOrder).deep.equals(['leaf', 'child', 'root']);
    expect(environment.viewport.isInputHandled()).equals(false);
  });

  it('inherits recursive behavior only from a direct control parent', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const bridge = createCanvasItem(environment, root);
    const leaf = createControl(environment, 'leaf', 40, 40, bridge);

    root.mouseBehaviorRecursive = MouseBehaviorRecursive.Disabled;
    expect(environment.viewport.guiFindControl(new Vector2(10, 10))).equals(leaf);

    const direct = createControl(environment, 'direct', 40, 40, root);

    direct.topLevel = true;
    environment.layer.canvasItems.push(direct);
    environment.viewport.markRootsOrderDirty();
    expect(direct.getMouseFilterWithOverride()).equals(MouseFilter.Ignore);
  });

  it('shares mouse focus across buttons and delivers internal releases when focus is dropped', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const releasedButtons: MouseButton[] = [];
    const releaseDevices: number[] = [];

    target.mouseFilter = MouseFilter.Pass;
    target.mouseUpCallback = (location, button, event) => {
      releasedButtons.push(button);
      releaseDevices.push(event.device);
    };

    environment.viewport.pushInput(mouseButton(10, 10, true, MouseButton.Left));
    environment.viewport.pushInput(mouseButton(150, 150, true, MouseButton.Right));
    environment.viewport.pushInput(mouseButton(150, 150, false, MouseButton.Left));
    environment.viewport.pushInput(mouseMotion(150, 150, 10, 10));
    environment.viewport.pushInput(mouseButton(150, 150, false, MouseButton.Right));
    environment.viewport.pushInput(mouseMotion(150, 150, 0, 0));
    expect(target.inputLog.length).equals(5);

    releasedButtons.length = 0;
    releaseDevices.length = 0;
    environment.viewport.pushInput(mouseButton(10, 10, true, MouseButton.Left));
    environment.viewport.pushInput(mouseButton(10, 10, true, MouseButton.Right));
    environment.viewport.cancelPointerInput();
    expect(releasedButtons).deep.equals([MouseButton.Left, MouseButton.Right]);
    expect(releaseDevices).deep.equals([
      InputEventMouseButton.deviceIdInternal,
      InputEventMouseButton.deviceIdInternal,
    ]);
  });

  it('re-runs hit testing when an already pressed button is pressed again', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 200, 100);
    const child = createControl(environment, 'child', 40, 40, root);

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    environment.viewport.pushInput(mouseButton(10, 10, true));
    environment.viewport.pushInput(mouseButton(100, 10, true));
    expect(child.inputLog).deep.equals(['child:down:10,10']);
    expect(root.inputLog).deep.equals(['root:down:10,10', 'root:down:100,10']);
  });

  it('keeps touch focus through screen drag and release', () => {
    const environment = createEnvironment();
    const target = createControl(environment, 'target', 100, 100);
    const touch = new InputEventScreenTouch();

    touch.index = 3;
    touch.pressed = true;
    touch.position.set(10, 10);
    environment.viewport.pushInput(touch);

    const drag = new InputEventScreenDrag();

    drag.index = 3;
    drag.pressed = true;
    drag.position.set(150, 150);
    drag.relative.set(140, 140);
    environment.viewport.pushInput(drag);

    touch.pressed = false;
    touch.position.set(150, 150);
    environment.viewport.pushInput(touch);
    expect(target.inputLog.length).equals(3);
  });

  it('treats top level controls as separate roots without parent bubbling', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 40, 40, root, 10, 10);

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    child.topLevel = true;
    environment.layer.canvasItems.push(child);
    environment.viewport.markRootsOrderDirty();
    environment.viewport.pushInput(mouseButton(20, 20, true));
    expect(child.inputLog).deep.equals(['child:down:10,10']);
    expect(root.inputLog).deep.equals([]);

    root.item.isActive = false;
    environment.viewport.markRootsOrderDirty();
    expect(environment.viewport.guiFindControl(new Vector2(20, 20))).equals(null);
  });

  it('queries cursor shapes on an ignored direct parent', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 50, 50, root);

    root.mouseFilter = MouseFilter.Ignore;
    root.defaultCursorShape = CursorShape.PointingHand;
    child.mouseFilter = MouseFilter.Pass;
    environment.viewport.pushInput(mouseMotion(10, 10, 1, 1));
    expect(environment.engine.canvas.style.cursor).equals('pointer');
    expect(root.inputLog).deep.equals([]);
  });

  it('queries cursor shapes through the parent chain and stops after invalidation', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 50, 50, root);

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    root.defaultCursorShape = CursorShape.PointingHand;
    environment.viewport.pushInput(mouseMotion(10, 10, 1, 1));
    expect(environment.engine.canvas.style.cursor).equals('pointer');

    child.mouseFilter = MouseFilter.Stop;
    environment.viewport.pushInput(mouseMotion(10, 10, 0, 0));
    expect(environment.engine.canvas.style.cursor).equals('default');

    child.mouseFilter = MouseFilter.Pass;
    child.mouseDownCallback = () => {
      child.enabled = false;
    };
    environment.viewport.pushInput(mouseButton(10, 10, true));
    expect(child.inputLog).deep.equals([
      'child:move:10,10',
      'child:move:10,10',
      'child:down:10,10',
    ]);
    expect(root.inputLog.length).equals(2);
  });

  it('sends key events only to the focus owner and handles them through acceptEvent', () => {
    const environment = createEnvironment();
    const root = createControl(environment, 'root', 100, 100);
    const child = createControl(environment, 'child', 50, 50, root);

    root.mouseFilter = MouseFilter.Pass;
    child.mouseFilter = MouseFilter.Pass;
    child.focusMode = FocusMode.Click;
    environment.viewport.pushInput(mouseButton(10, 10, true));
    environment.viewport.pushInput(mouseButton(10, 10, false));
    root.inputLog.length = 0;
    child.inputLog.length = 0;

    child.keyDownCallback = () => child.acceptEvent();
    const pressed = new InputEventKey();

    pressed.pressed = true;
    pressed.keycode = 'Enter';
    environment.viewport.pushInput(pressed);
    expect(child.inputLog).deep.equals(['child:key-down:Enter']);
    expect(root.inputLog).deep.equals([]);
    expect(environment.viewport.isInputHandled()).equals(true);

    const released = new InputEventKey();

    released.keycode = 'Enter';
    environment.viewport.pushInput(released);
    expect(child.inputLog).deep.equals([
      'child:key-down:Enter',
      'child:key-up:Enter',
    ]);
    expect(environment.viewport.isInputHandled()).equals(false);

    child.enabled = false;
    environment.viewport.pushInput(pressed);
    expect(child.inputLog.length).equals(2);
    expect(environment.viewport.guiGetFocusOwner()).equals(null);
  });
});

function createEnvironment (): TestEnvironment {
  const canvas = document.createElement('canvas');

  canvas.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON: () => ({}),
  });

  const layer = { layer: 0, canvasItems: [] } as unknown as CanvasLayer;
  const composition = {
    engine: null,
    interactive: true,
    getIndex: () => 0,
    hitTest: () => [],
  } as unknown as Composition;
  const data = {
    canvas,
    compositions: [composition],
    objectInstance: {},
    getViewportsInRenderOrder (this: { compositions: Composition[] }) {
      return this.compositions.map(composition => composition.viewport);
    },
    addInstance (this: { objectInstance: Record<string, Control> }, object: Control) {
      this.objectInstance[object.getInstanceId()] = object;
    },
    removeInstance (this: { objectInstance: Record<string, Control> }, id: string) {
      delete this.objectInstance[id];
    },
    on () {
      return () => { };
    },
    off () { },
  } as unknown as Engine & { viewport: Window };

  data.viewport = new Window(data);
  const viewport = new SubViewport(data);
  const viewportItem = {
    composition,
    isInsideTree: true,
    parent: null,
    components: [viewport],
  } as unknown as VFXItem;

  viewport.item = viewportItem;
  (composition as unknown as { engine: Engine, viewport: Viewport }).engine = data;
  (composition as unknown as { engine: Engine, viewport: Viewport }).viewport = viewport;
  viewport.canvasLayers.push(layer);

  return { engine: data, viewport, composition, layer };
}

function createControl (
  environment: TestEnvironment,
  label: string,
  width: number,
  height: number,
  parent?: CanvasItem,
  x = 0,
  y = 0,
): InputControl {
  const control = new InputControl(environment.engine, label);
  const transform = new RectTransform();
  const item = {
    transform,
    isActive: true,
    isInsideTree: true,
    composition: environment.composition,
    parent: parent?.item ?? null,
    components: [control],
    getComponent: () => undefined,
    getViewport: () => environment.viewport,
  } as unknown as VFXItem;

  transform.engine = environment.engine;
  control.item = item;

  if (parent) {
    control.parent = parent;
    parent.children.push(control);
    transform.parentTransform = parent.transform;
  } else {
    environment.layer.canvasItems.push(control);
    environment.viewport.addRootControl(control);
  }
  transform.setSize(width, height);
  transform.setPosition(x, y, 0);

  return control;
}

function createCanvasItem (environment: TestEnvironment, parent: CanvasItem): CanvasItem {
  const canvasItem = new CanvasItem(environment.engine);
  const transform = new RectTransform();
  const item = {
    transform,
    isActive: true,
    isInsideTree: true,
    composition: environment.composition,
    parent: parent.item,
    components: [canvasItem],
    getComponent: () => undefined,
    getViewport: () => environment.viewport,
  } as unknown as VFXItem;

  transform.engine = environment.engine;
  transform.parentTransform = parent.transform;
  canvasItem.item = item;
  canvasItem.parent = parent;
  parent.children.push(canvasItem);

  return canvasItem;
}

function createTouchEvent (
  type: 'touchstart' | 'touchend' | 'touchmove' | 'touchcancel',
  identifier: number,
  clientX: number,
  clientY: number,
): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;

  Object.defineProperty(event, 'changedTouches', {
    value: [{ identifier, clientX, clientY }],
  });

  return event;
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
  event.position.set(x, y);
  event.globalPosition.set(x, y);

  return event;
}

function wheelButton (x: number, y: number): InputEventMouseButton {
  const event = mouseButton(x, y, true, MouseButton.WheelDown);

  event.factor = 1;

  return event;
}

function mouseMotion (x: number, y: number, dx: number, dy: number): InputEventMouseMotion {
  const event = new InputEventMouseMotion();

  event.position.set(x, y);
  event.globalPosition.set(x, y);
  event.relative.set(dx, dy);
  event.screenRelative.set(dx, dy);

  return event;
}
