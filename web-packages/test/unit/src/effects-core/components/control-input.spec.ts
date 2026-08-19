import type { Control } from '@galacean/effects';
import {
  Composition,
  ContainerControl,
  FocusMode,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  MouseFilter,
  Player,
  UIControl,
  UICanvas,
  VFXItem,
  math,
} from '@galacean/effects';

const { expect } = chai;
const { Vector2 } = math;

class RecordingControl extends ContainerControl {
  readonly log: string[] = [];

  override onMouseDown (position: math.Vector2): void {
    this.log.push(`down:${position.x},${position.y}`);
  }

  override onMouseMove (position: math.Vector2): void {
    this.log.push(`move:${position.x},${position.y}`);
  }

  override onTouchDown (position: math.Vector2, pointerId: number): void {
    this.log.push(`touch-down:${pointerId}:${position.x},${position.y}`);
  }

  override onTouchMove (position: math.Vector2, pointerId: number): void {
    this.log.push(`touch-move:${pointerId}:${position.x},${position.y}`);
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
