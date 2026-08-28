import {
  Composition,
  Player,
  VFXItem,
  math,
} from '@galacean/effects';
import {
  AspectRatioContainer,
  CenterContainer,
  Container,
  Control,
  GrowDirection,
  GridContainer,
  HBoxContainer,
  MarginContainer,
  PanelContainer,
  SizeFlags,
  StyleBoxFlat,
  UIControl,
  GUIRootComponent,
  UICanvas,
} from '@galacean/effects-plugin-gui';

const { expect } = chai;

class MeasuredControl extends Control {
  minimum = new math.Vector2();
  desired = new math.Vector2();
  maximum = new math.Vector2(-1, -1);

  override getMinimumSize (): math.Vector2 { return this.minimum.clone(); }
  override getDesiredSize (): math.Vector2 { return this.desired.clone(); }
  override getMaximumSize (): math.Vector2 { return this.maximum.clone(); }

  invalidateMeasurements (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
    this.updateMaximumSize();
  }
}

class SelfQueuingLayout extends Container {
  sortCount = 0;

  protected override sortChildren (): void {
    this.sortCount++;
    this.queueSort();
  }
}

class CountingLayout extends Container {
  sortCount = 0;

  protected override sortChildren (): void {
    this.sortCount++;
    const child = this.children[0];

    if (child) {
      this.fitChildInRect(child, {
        position: new math.Vector2(),
        size: this.size.clone(),
      });
    }
  }
}

describe('plugin-gui/GUI measurement and automatic layout', () => {
  let player: Player;
  let composition: Composition;

  beforeEach(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      pixelRatio: 1,
      manualRender: true,
    });
    composition = new Composition(player.engine);
    composition.root.awake();
    composition.root.beginPlay();
  });

  afterEach(() => player.dispose());

  it('caches and resolves minimum, desired and maximum constraints', () => {
    const control = new MeasuredControl(player.engine);

    control.minimum.set(10, 20);
    control.desired.set(30, 40);
    control.maximum.set(80, 15);
    control.invalidateMeasurements();
    expect(control.getCombinedMinimumSize()).deep.equals(new math.Vector2(10, 20));
    expect(control.getBoundMinimumSize()).deep.equals(new math.Vector2(10, 15));
    expect(control.getBoundDesiredSize()).deep.equals(new math.Vector2(30, 15));

    const returned = control.getCombinedMinimumSize();

    returned.set(999, 999);
    expect(control.getCombinedMinimumSize()).deep.equals(new math.Vector2(10, 20));

    control.setCustomMinimumSize(50, 5);
    control.setCustomMaximumSize(25, -1);
    expect(control.getBoundMinimumSize()).deep.equals(new math.Vector2(25, 15));
    expect(control.getBoundDesiredSize()).deep.equals(new math.Vector2(25, 15));
  });

  it('applies grow direction when constraints enlarge a requested rectangle', () => {
    const control = new Control(player.engine);

    control.setCustomMinimumSize(40, 20);
    control.horizontalGrowDirection = GrowDirection.Begin;
    control.verticalGrowDirection = GrowDirection.Both;
    control.setRect({
      position: new math.Vector2(10, 10),
      size: new math.Vector2(10, 10),
    });

    expect([control.x, control.y, control.width, control.height]).deep.equals([-20, 5, 40, 20]);
    expect(() => { control.stretchRatio = 0; }).throws(RangeError);
    expect(() => control.setCustomMaximumSize(Number.NaN, 2)).throws(RangeError);
  });

  it('allocates Box desired space first, then expands by stretch ratio', () => {
    const box = new HBoxContainer(player.engine);
    const first = measuredChild(20, 10, 30, 10);
    const second = measuredChild(20, 10, 30, 10);

    box.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    box.setSize(110, 30);
    box.setThemeConstantOverride('separation', 10);
    first.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    second.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    second.stretchRatio = 3;
    first.setRotation(30);
    first.setScale(2, 3);
    first.setShear(4, 5);
    first.setPivot(0.25, 0.75);
    box.addChild(first);
    box.addChild(second);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect([first.x, first.width, second.x, second.width]).deep.equals([0, 40, 50, 60]);
    expect([first.height, second.height]).deep.equals([30, 30]);
    expect(first.rotation).equals(0);
    expect(first.scale).deep.equals(new math.Vector2(1, 1));
    expect(first.shear).deep.equals(new math.Vector2(0, 0));
    expect(first.pivot).deep.equals(new math.Vector2(0.25, 0.75));

    first.maximum.set(35, -1);
    first.invalidateMeasurements();
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);
    expect([first.width, second.x, second.width]).deep.equals([35, 45, 65]);

    first.maximum.set(-1, -1);
    first.invalidateMeasurements();
    second.visible = false;
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);
    expect(first.width).equals(110);
  });

  it('lays out Grid, Margin, Center and AspectRatio containers', () => {
    const grid = new GridContainer(player.engine);

    grid.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    grid.columns = 2;
    grid.setSize(100, 60);
    const gridChildren = Array.from({ length: 4 }, () => measuredChild(10, 10, 10, 10));

    for (const child of gridChildren) {
      child.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
      grid.addChild(child);
    }

    const margin = new MarginContainer(player.engine);
    const marginChild = measuredChild(20, 10, 20, 10);

    margin.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    margin.setSize(100, 50);
    margin.setThemeConstantOverride('marginLeft', 5);
    margin.setThemeConstantOverride('marginTop', 6);
    margin.setThemeConstantOverride('marginRight', 7);
    margin.setThemeConstantOverride('marginBottom', 8);
    margin.addChild(marginChild);

    const center = new CenterContainer(player.engine);
    const centerChild = measuredChild(20, 10, 20, 10);

    center.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    center.setSize(100, 50);
    center.addChild(centerChild);

    const aspect = new AspectRatioContainer(player.engine);
    const aspectChild = measuredChild(0, 0, 0, 0);

    aspect.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    aspect.setSize(100, 100);
    aspect.ratio = 2;
    aspect.addChild(aspectChild);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect(gridChildren.map(child => [child.x, child.y, child.width, child.height])).deep.equals([
      [0, 0, 50, 30],
      [50, 0, 50, 30],
      [0, 30, 50, 30],
      [50, 30, 50, 30],
    ]);
    expect([marginChild.x, marginChild.y, marginChild.width, marginChild.height]).deep.equals([5, 6, 88, 36]);
    expect([centerChild.x, centerChild.y, centerChild.width, centerChild.height]).deep.equals([40, 20, 20, 10]);
    expect([aspectChild.x, aspectChild.y, aspectChild.width, aspectChild.height]).deep.equals([0, 25, 100, 50]);
  });

  it('measures and lays out PanelContainer inside StyleBox content margins', () => {
    const panel = new PanelContainer(player.engine);
    const child = measuredChild(20, 10, 40, 30);
    const style = new StyleBoxFlat();

    style.setContentMargins(5, 6, 7, 8);
    panel.setThemeStyleBoxOverride('panel', style);
    panel.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    panel.setSize(100, 60);
    child.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    panel.addChild(child);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect(panel.getMinimumSize()).deep.equals(new math.Vector2(32, 24));
    expect(panel.getDesiredSize()).deep.equals(new math.Vector2(52, 44));
    expect([child.x, child.y, child.width, child.height]).deep.equals([5, 6, 88, 46]);
  });

  it('flushes nested layout defensively before render', () => {
    const outer = new MarginContainer(player.engine);
    const inner = new GridContainer(player.engine);
    const child = measuredChild(10, 10, 10, 10);

    outer.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    outer.setSize(120, 70);
    outer.setThemeConstantOverride('marginLeft', 5);
    outer.setThemeConstantOverride('marginTop', 6);
    outer.setThemeConstantOverride('marginRight', 7);
    outer.setThemeConstantOverride('marginBottom', 8);
    outer.addChild(inner);
    child.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    inner.addChild(child);

    player.engine.root.getComponent(GUIRootComponent).windowRoot.render();

    expect([inner.x, inner.y, inner.width, inner.height]).deep.equals([5, 6, 108, 56]);
    expect([child.x, child.y, child.width, child.height]).deep.equals([0, 0, 108, 56]);
  });

  it('does not queue another pass for child geometry produced by layout', () => {
    const layout = new CountingLayout(player.engine);
    const child = new Control(player.engine);

    layout.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    layout.setSize(100, 30);
    layout.addChild(child);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect(layout.sortCount).equals(1);
    expect([child.width, child.height]).deep.equals([100, 30]);
  });

  it('queues pending layouts when a detached canvas attaches to the window', () => {
    const margin = new MarginContainer(player.engine);
    const child = measuredChild(20, 10, 20, 10);

    composition.sceneRoot.getComponent(UICanvas).enabled = false;
    margin.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    margin.setAnchorsAndOffsetsPreset('fullRect');
    margin.setThemeConstantOverride('marginLeft', 10);
    margin.setThemeConstantOverride('marginTop', 10);
    margin.setThemeConstantOverride('marginRight', 10);
    margin.setThemeConstantOverride('marginBottom', 10);
    margin.addChild(child);

    composition.sceneRoot.getComponent(UICanvas).enabled = true;
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect([margin.x, margin.y, margin.width, margin.height]).deep.equals([0, 0, 300, 150]);
    expect([child.x, child.y, child.width, child.height]).deep.equals([10, 10, 280, 130]);
  });

  it('keeps UIControl item-to-control XY one-way inside automatic layout', () => {
    const parentItem = new VFXItem(player.engine);
    const parentBridge = parentItem.addComponent(UIControl);
    const box = new HBoxContainer(player.engine);

    parentBridge.control = box;
    parentItem.setParent(composition.sceneRoot);
    box.setSize(100, 30);

    const childItem = new VFXItem(player.engine);
    const childBridge = childItem.addComponent(UIControl);
    const child = measuredChild(20, 10, 20, 10);

    childItem.transform.setPosition(77, 8, 3);
    childBridge.control = child;
    childItem.setParent(parentItem);
    expect(child.parent).instanceOf(Container);
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect([child.x, child.y]).deep.equals([0, 0]);
    expect([childItem.transform.position.x, childItem.transform.position.y]).deep.equals([0, 0]);
    childItem.transform.setPosition(88, 9, 3);
    expect([child.x, child.y]).deep.equals([0, 0]);
    expect([childItem.transform.position.x, childItem.transform.position.y]).deep.equals([88, 9]);
  });

  it('coalesces queueSort calls raised during the current layout pass', () => {
    const layout = new SelfQueuingLayout(player.engine);

    layout.parent = composition.sceneRoot.getComponent(UICanvas).rootControl;
    player.engine.root.getComponent(GUIRootComponent).windowRoot.update(0);

    expect(layout.sortCount).equals(1);
  });

  function measuredChild (
    minimumWidth: number,
    minimumHeight: number,
    desiredWidth: number,
    desiredHeight: number,
  ): MeasuredControl {
    const child = new MeasuredControl(player.engine);

    child.minimum.set(minimumWidth, minimumHeight);
    child.desired.set(desiredWidth, desiredHeight);
    child.invalidateMeasurements();

    return child;
  }
});
