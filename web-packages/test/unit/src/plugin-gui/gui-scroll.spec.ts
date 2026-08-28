import {
  Composition,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  Player,
  math,
} from '@galacean/effects';
import type { Texture } from '@galacean/effects';
import {
  Control,
  FocusMode,
  HScrollBar,
  Range,
  ScrollContainer,
  ScrollMode,
  SizeFlags,
  StyleBoxEmpty,
  Theme,
  VScrollBar,
  GUIWindowComponent,
  UICanvas,
} from '@galacean/effects-plugin-gui';

const { expect } = chai;

class ScrollContent extends Control {
  mouseDownCount = 0;

  constructor (engine: Player['engine'], private readonly minimum: math.Vector2) {
    super(engine);
  }

  override getMinimumSize (): math.Vector2 {
    return this.minimum.clone();
  }

  override onMouseDown (): void {
    this.mouseDownCount++;
  }
}

class TestScrollContainer extends ScrollContainer {
  drawChildrenForTest (): void {
    this.drawChildren();
  }
}

describe('plugin-gui/GUI clipping and scrolling', () => {
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

  it('matches Range snapping, page bounds, signals and shared values', () => {
    const first = new Range(player.engine);
    const second = new Range(player.engine);
    const values: number[] = [];
    let changed = 0;

    first.on('valueChanged', value => values.push(value));
    first.on('changed', () => changed++);
    first.minValue = 0.1;
    first.maxValue = 10.1;
    first.step = 0.2;
    first.page = 2;
    first.value = 9.9;
    expect(first.value).equals(8.1);
    expect(changed).equals(4);

    first.setValueNoSignal(4.31);
    expect(first.value).equals(4.3);
    expect(values[values.length - 1]).equals(8.1);

    first.share(second);
    first.value = 3.1;
    expect(second.value).equals(3.1);
    second.unshare();
    first.value = 5.1;
    expect(second.value).equals(3.1);
  });

  it('supports ScrollBar buttons, track, wheel and orientation', () => {
    const horizontal = new HScrollBar(player.engine);
    const vertical = new VScrollBar(player.engine);
    const decrement = { width: 12, height: 12 } as Texture;
    const increment = { width: 12, height: 12 } as Texture;

    horizontal.setThemeIconOverride('decrement', decrement);
    horizontal.setThemeIconOverride('increment', increment);
    horizontal.setSize(120, 12);
    horizontal.maxValue = 200;
    horizontal.page = 40;
    horizontal.customStep = 5;
    horizontal.onMouseDown(mouseButton(119, 6, MouseButton.Left));
    expect(horizontal.value).equals(5);

    horizontal.onMouseDown(mouseButton(100, 6, MouseButton.Left));
    expect(horizontal.value).equals(45);

    const wheel = mouseButton(6, 6, MouseButton.WheelDown);

    wheel.factor = 1;
    horizontal.onMouseWheel(wheel);
    expect(horizontal.value).equals(50);
    expect(wheel.isAccepted()).equals(true);
    expect(vertical.getMinimumSize()).deep.equals(new math.Vector2(8, 8));
  });

  it('uses the default ScrollBar theme without visible end buttons', () => {
    const vertical = new VScrollBar(player.engine);
    let iconDraws = 0;

    vertical.setSize(8, 100);
    vertical.drawStyleBox = (() => undefined) as typeof vertical.drawStyleBox;
    vertical.drawTexture = (() => {iconDraws++;}) as typeof vertical.drawTexture;
    vertical.draw();
    expect(iconDraws).equals(0);
    expect(vertical.getMinimumSize()).deep.equals(new math.Vector2(8, 8));
  });

  it('emits scrolling while the ScrollBar grabber is dragged', () => {
    const horizontal = new HScrollBar(player.engine);
    const motion = new InputEventMouseMotion();
    let scrolling = 0;

    horizontal.setSize(120, 12);
    horizontal.maxValue = 200;
    horizontal.page = 40;
    horizontal.setValueNoSignal(40);
    horizontal.on('scrolling', () => scrolling++);
    horizontal.onMouseDown(mouseButton(35, 6, MouseButton.Left));
    motion.position.set(60, 6);
    horizontal.onMouseMove(motion);
    expect(horizontal.value).greaterThan(40);
    expect(scrolling).equals(1);

    horizontal.onMouseMove(motion);
    expect(scrolling).equals(1);
  });

  it('uses ScrollBar track margins and cross-axis padding for the grabber', () => {
    const horizontal = new HScrollBar(player.engine);
    const theme = new Theme();
    const scroll = new StyleBoxEmpty();
    const grabber = new StyleBoxEmpty();
    const decrement = { width: 8, height: 10 } as Texture;
    const increment = { width: 9, height: 11 } as Texture;
    let grabberRect: number[] | undefined;

    scroll.setContentMargins(5, 0, 7, 0);
    grabber.setContentMargins(6, 0, 6, 0);
    theme.setStyleBox('HScrollBar', 'scroll', scroll);
    theme.setStyleBox('HScrollBar', 'grabber', grabber);
    theme.setIcon('HScrollBar', 'decrement', decrement);
    theme.setIcon('HScrollBar', 'increment', increment);
    theme.setConstant('HScrollBar', 'paddingTop', 2);
    theme.setConstant('HScrollBar', 'paddingBottom', 3);
    horizontal.theme = theme;
    horizontal.setSize(100, 16);
    horizontal.maxValue = 100;
    horizontal.drawStyleBox = ((style, x, y, width, height) => {
      if (style === grabber) {
        grabberRect = [x, y, width, height];
      }
    }) as typeof horizontal.drawStyleBox;
    horizontal.drawTexture = (() => undefined) as typeof horizontal.drawTexture;
    horizontal.draw();

    expect(horizontal.getMinimumSize()).deep.equals(new math.Vector2(41, 16));
    expect(grabberRect).deep.equals([13, 2, 12, 11]);
  });

  it('resolves both scroll bars and repositions expanded content', () => {
    const scroll = new ScrollContainer(player.engine);
    const content = new ScrollContent(player.engine, new math.Vector2(180, 220));

    scroll.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    scroll.setSize(100, 100);
    content.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    scroll.addChild(content);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);

    expect(scroll.clipContents).equals(true);
    expect(scroll.getHScrollBar().visible).equals(true);
    expect(scroll.getVScrollBar().visible).equals(true);
    expect([scroll.getHScrollBar().page, scroll.getVScrollBar().page]).deep.equals([92, 92]);

    scroll.hScroll = 30;
    scroll.vScroll = 40;
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);
    expect([content.x, content.y, content.width, content.height]).deep.equals([-30, -40, 180, 220]);
  });

  it('keeps scroll bars above content for drawing and input', () => {
    const scroll = new TestScrollContainer(player.engine);
    const first = new ScrollContent(player.engine, new math.Vector2(180, 220));
    const second = new ScrollContent(player.engine, new math.Vector2(180, 220));
    const drawOrder: string[] = [];

    scroll.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    scroll.setSize(100, 100);
    scroll.addChild(first);
    scroll.addChild(second);
    scroll.changeChildIndex(first, -1);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);

    expect(scroll.children).deep.equals([
      scroll.getHScrollBar(),
      scroll.getVScrollBar(),
      second,
      first,
    ]);
    first.drawInternal = () => drawOrder.push('first');
    second.drawInternal = () => drawOrder.push('second');
    scroll.getHScrollBar().drawInternal = () => drawOrder.push('horizontal');
    scroll.getVScrollBar().drawInternal = () => drawOrder.push('vertical');
    player.engine.graphics.begin();
    scroll.drawChildrenForTest();
    player.engine.graphics.end();
    expect(drawOrder).deep.equals(['second', 'first', 'vertical', 'horizontal']);
    const event = mouseButton(94, 60, MouseButton.Left);

    event.globalPosition.copyFrom(event.position);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.pushInput(event);
    expect(first.mouseDownCount).equals(0);
    expect(second.mouseDownCount).equals(0);
    expect(scroll.getVScrollBar().value).greaterThan(0);
  });

  it('implements all ScrollMode visibility and reservation rules', () => {
    const scroll = new ScrollContainer(player.engine);
    const content = new ScrollContent(player.engine, new math.Vector2(40, 40));

    scroll.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    scroll.setSize(100, 100);
    scroll.addChild(content);
    scroll.horizontalScrollMode = ScrollMode.ShowAlways;
    scroll.verticalScrollMode = ScrollMode.Reserve;
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);
    expect(scroll.getHScrollBar().visible).equals(true);
    expect(scroll.getVScrollBar().visible).equals(false);
    expect(scroll.getHScrollBar().page).equals(92);

    scroll.horizontalScrollMode = ScrollMode.ShowNever;
    scroll.verticalScrollMode = ScrollMode.Disabled;
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);
    expect(scroll.getHScrollBar().visible).equals(false);
    expect(scroll.getVScrollBar().visible).equals(false);
  });

  it('passes wheel input to an outer container at an inner boundary', () => {
    const outer = new ScrollContainer(player.engine);
    const outerContent = new ScrollContent(player.engine, new math.Vector2(100, 400));
    const inner = new ScrollContainer(player.engine);
    const innerContent = new ScrollContent(player.engine, new math.Vector2(100, 300));

    outer.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    outer.setSize(100, 100);
    outer.addChild(outerContent);
    inner.parent = outerContent;
    inner.setSize(100, 100);
    inner.addChild(innerContent);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);
    inner.vScroll = 300;
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);
    const innerBoundary = inner.vScroll;
    const wheel = mouseButton(50, 50, MouseButton.WheelDown);

    wheel.globalPosition.set(50, 50);
    wheel.factor = 1;
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.pushInput(wheel);
    expect(inner.vScroll).equals(innerBoundary);
    expect(outer.vScroll).greaterThan(0);
    expect(wheel.isAccepted()).equals(true);
  });

  it('normalizes native pixel wheel deltas to one scroll factor', () => {
    const scroll = new ScrollContainer(player.engine);
    const content = new ScrollContent(player.engine, new math.Vector2(40, 500));

    scroll.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    scroll.setSize(100, 100);
    scroll.addChild(content);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);
    player.canvas.dispatchEvent(new WheelEvent('wheel', {
      deltaY: 100,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      clientX: 50,
      clientY: 50,
      cancelable: true,
      bubbles: true,
    }));
    expect(scroll.vScroll).equals(12.5);
  });

  it('drags with a deadzone and continues with inertial scrolling', () => {
    const scroll = new ScrollContainer(player.engine);
    const content = new ScrollContent(player.engine, new math.Vector2(100, 500));
    const events: string[] = [];

    scroll.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    scroll.setSize(100, 100);
    scroll.addChild(content);
    scroll.deadzone = 5;
    scroll.on('scrollStarted', () => events.push('start'));
    scroll.on('scrollEnded', () => events.push('end'));
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);

    const down = new InputEventScreenTouch();

    down.index = 1;
    down.pressed = true;
    down.position.set(50, 50);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.pushInput(down);
    const drag = new InputEventScreenDrag();

    drag.index = 1;
    drag.position.set(50, 10);
    drag.relative.set(0, -40);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.pushInput(drag);
    expect(scroll.vScroll).equals(40);
    expect(events).deep.equals(['start']);

    scroll.update(100);
    const up = new InputEventScreenTouch();

    up.index = 1;
    up.position.set(50, 10);
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.pushInput(up);
    scroll.update(100);
    expect(scroll.vScroll).greaterThan(40);

    for (let index = 0; index < 10; index++) {
      scroll.update(100);
    }
    expect(events).deep.equals(['start', 'end']);
  });

  it('reveals transformed descendants and follows keyboard focus', () => {
    const lateComposition = new Composition(player.engine);
    const scroll = new ScrollContainer(player.engine);
    const content = new ScrollContent(player.engine, new math.Vector2(100, 500));
    const target = new Control(player.engine);

    scroll.parent = lateComposition.sceneRoot.getComponent(UICanvas).rootControl;
    scroll.setSize(100, 100);
    scroll.followFocus = true;
    scroll.addChild(content);
    target.parent = content;
    target.setRect({ position: new math.Vector2(10, 350), size: new math.Vector2(30, 20) });
    target.setRotation(20);
    target.focusMode = FocusMode.All;
    lateComposition.root.awake();
    lateComposition.root.beginPlay();
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.update(0);

    target.grabFocus();
    expect(scroll.vScroll).greaterThan(250);
    expect(scroll.vScroll).lessThanOrEqual(300);
  });

  it('emits guiFocusChanged from the root when the focus owner changes', () => {
    const control = new Control(player.engine);
    const focusChanges: Array<Control | null> = [];
    const focusChanged = (owner: Control | null) => focusChanges.push(owner);

    control.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    control.focusMode = FocusMode.All;
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.on('guiFocusChanged', focusChanged);
    control.grabFocus();
    control.grabFocus();
    control.releaseFocus();
    player.engine.root.getComponent(GUIWindowComponent).windowRoot.off('guiFocusChanged', focusChanged);
    control.grabFocus();

    expect(focusChanges).deep.equals([control, null]);
  });
});

function mouseButton (x: number, y: number, button: MouseButton): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.position.set(x, y);
  event.buttonIndex = button;
  event.pressed = true;

  return event;
}
