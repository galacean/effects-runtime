import {
  Composition,
  Control,
  Player,
  RootControl,
  UICanvas,
  UIControl,
  VFXItem,
  math,
} from '@galacean/effects';

const { expect } = chai;
const { Vector2 } = math;

class LifecycleControl extends Control {
  destroyCount = 0;

  override onDestroy (): void {
    this.destroyCount++;
  }
}

describe('core/GUI topology', () => {
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

  it('keeps the window as the only RootControl and canvases as ordinary containers', () => {
    expect(player.engine.windowRoot).instanceOf(RootControl);
    expect(composition.uiCanvas.rootControl).instanceOf(Control);
    expect(composition.uiCanvas.rootControl).not.instanceOf(RootControl);
    expect(player.engine.windowRoot.canvases.parent).equals(player.engine.windowRoot);
    expect(composition.sceneRoot.getComponent(UICanvas)).equals(composition.uiCanvas);
    expect(composition.uiCanvas.rootControl.parent).equals(player.engine.windowRoot.canvases);
    expect(composition.uiCanvas.rootControl.root).equals(player.engine.windowRoot);
  });

  it('builds a GUI tree through UIControl bridges', () => {
    const parentItem = new VFXItem(player.engine);
    const parentBridge = parentItem.addComponent(UIControl);
    const parentControl = new Control(player.engine);

    parentBridge.control = parentControl;
    parentItem.setParent(composition.sceneRoot);

    const childItem = new VFXItem(player.engine);
    const childBridge = childItem.addComponent(UIControl);
    const childControl = new Control(player.engine);

    childBridge.control = childControl;
    childItem.setParent(parentItem);

    expect(parentControl.parent).equals(composition.uiCanvas.rootControl);
    expect(childControl.parent).equals(parentControl);
    expect(parentControl.children).includes(childControl);
    expect(parentControl.root).equals(player.engine.windowRoot);
    expect(childControl.root).equals(player.engine.windowRoot);
  });

  it('keeps the VFXItem transform independent from Control layout while synchronizing local XY position', () => {
    const item = new VFXItem(player.engine);
    const bridge = item.addComponent(UIControl);
    const control = new Control(player.engine);
    const itemTransform = item.transform;
    const controlPosition = control.position;
    const controlSize = control.size;

    item.transform.setPosition(12, 18, 7);
    item.transform.setRotation(0.1, 0.2, 0.3);
    item.transform.setScale(2, 3, 4);
    bridge.control = control;
    item.setParent(composition.sceneRoot);

    expect(item.transform).equals(itemTransform);
    expect('transform' in control).equals(false);
    expect(control.position).equals(controlPosition);
    expect(control.size).equals(controlSize);
    expect(control.position.x).equals(12);
    expect(control.position.y).equals(18);

    control.setSize(80, 40);
    control.setRotation(45);
    control.setScale(5, 6);
    expect(item.transform.size.x).equals(1);
    expect(item.transform.size.y).equals(1);
    expect(item.transform.rotation.z).equals(0.3);
    expect(item.transform.scale.x).equals(2);
    expect(item.transform.scale.y).equals(3);

    control.setPosition(30, 40);
    expect(item.transform.position.x).equals(30);
    expect(item.transform.position.y).equals(40);
    expect(item.transform.position.z).equals(7);

    item.transform.setPosition(5, 6, 11);
    expect(control.position.x).equals(5);
    expect(control.position.y).equals(6);
    expect(control.rotation).equals(45);
    expect(control.scale.x).equals(5);
    expect(control.scale.y).equals(6);
  });

  it('owns anchored layout and the 2D transform directly on Control', () => {
    const parent = new Control(player.engine);
    const child = new Control(player.engine);

    parent.setSize(100, 80);
    child.parent = parent;
    child.setAnchorMax(1, 1);
    child.setOffsetMin(10, 20);
    child.setOffsetMax(-10, -20);

    expect(child.position.x).equals(10);
    expect(child.position.y).equals(20);
    expect(child.size.x).equals(80);
    expect(child.size.y).equals(40);

    parent.setSize(200, 160);
    expect(child.position.x).equals(10);
    expect(child.position.y).equals(20);
    expect(child.size.x).equals(180);
    expect(child.size.y).equals(120);

    child.setPivot(0.5, 0.5);
    child.setScale(2, 2);
    const matrix = child.getTransform2D().elements;

    expect(matrix[0]).equals(2);
    expect(matrix[4]).equals(2);
    expect(matrix[6]).equals(-80);
    expect(matrix[7]).equals(-40);
  });

  it('uses top-left coordinates for anchors and layout presets', () => {
    const expectations = [
      ['topLeft', 5, 5, 40, 20],
      ['topRight', 155, 5, 40, 20],
      ['bottomLeft', 5, 75, 40, 20],
      ['bottomRight', 155, 75, 40, 20],
      ['centerLeft', 5, 40, 40, 20],
      ['centerTop', 80, 5, 40, 20],
      ['centerRight', 155, 40, 40, 20],
      ['centerBottom', 80, 75, 40, 20],
      ['center', 80, 40, 40, 20],
      ['leftWide', 5, 5, 40, 90],
      ['topWide', 5, 5, 190, 20],
      ['rightWide', 155, 5, 40, 90],
      ['bottomWide', 5, 75, 190, 20],
      ['vcenterWide', 80, 5, 40, 90],
      ['hcenterWide', 5, 40, 190, 20],
      ['fullRect', 5, 5, 190, 90],
    ] as const;

    for (const [preset, x, y, width, height] of expectations) {
      const parent = new Control(player.engine);
      const child = new Control(player.engine);

      parent.setSize(200, 100);
      child.parent = parent;
      child.setSize(40, 20);
      child.setAnchorsAndOffsetsPreset(preset, 5);
      expect([child.x, child.y, child.width, child.height], preset).deep.equals([x, y, width, height]);
    }

    const top = new Control(player.engine);
    const bottom = new Control(player.engine);

    top.setAnchorsPreset('topLeft');
    bottom.setAnchorsPreset('bottomRight');
    expect(top.anchorMin).deep.equals(new Vector2(0, 0));
    expect(bottom.anchorMax).deep.equals(new Vector2(1, 1));
  });

  it('rotates positive GUI angles clockwise in the Y-down coordinate system', () => {
    const control = new Control(player.engine);

    control.setPosition(10, 20);
    control.setPivot(0, 0);
    control.setRotation(90);
    const matrix = control.getTransform2D().elements;
    const rightX = matrix[0] + matrix[6];
    const rightY = matrix[1] + matrix[7];

    expect(rightX).closeTo(10, 1e-10);
    expect(rightY).closeTo(21, 1e-10);
  });

  it('synchronizes GUI sibling order with VFXItem order', () => {
    const firstItem = new VFXItem(player.engine);
    const secondItem = new VFXItem(player.engine);

    firstItem.setParent(composition.sceneRoot);
    secondItem.setParent(composition.sceneRoot);

    const secondBridge = secondItem.addComponent(UIControl);
    const secondControl = new Control(player.engine);

    secondBridge.control = secondControl;

    const firstBridge = firstItem.addComponent(UIControl);
    const firstControl = new Control(player.engine);

    firstBridge.control = firstControl;

    expect(composition.uiCanvas.rootControl.children).deep.equals([firstControl, secondControl]);
    expect(firstControl.indexInParent).equals(0);
    expect(secondControl.indexInParent).equals(1);

    secondItem.orderInParent = 0;
    expect(composition.sceneRoot.children.slice(0, 2)).deep.equals([secondItem, firstItem]);
    expect(composition.uiCanvas.rootControl.children).deep.equals([secondControl, firstControl]);
    expect(secondControl.indexInParent).equals(0);
    expect(firstControl.indexInParent).equals(1);
  });

  it('synchronizes Control visibility when its VFXItem activation changes', () => {
    const item = new VFXItem(player.engine);
    const bridge = item.addComponent(UIControl);
    const control = new Control(player.engine);

    bridge.control = control;
    item.setParent(composition.sceneRoot);
    expect(control.visible).equals(true);
    expect(control.enabled).equals(true);

    item.setActive(false);
    expect(control.visible).equals(false);
    expect(control.enabled).equals(false);

    item.setActive(true);
    expect(control.visible).equals(true);
    expect(control.enabled).equals(true);
  });

  it('does not scan through ordinary VFXItems for a GUI parent', () => {
    const bridgeItem = new VFXItem(player.engine);
    const bridge = bridgeItem.addComponent(UIControl);
    const control = new Control(player.engine);
    const ordinary = new VFXItem(player.engine);

    bridge.control = control;
    ordinary.setParent(composition.sceneRoot);
    bridgeItem.setParent(ordinary);
    expect(control.parent).equals(null);
  });

  it('sorts independent canvases by UICanvas.order', () => {
    const overlayItem = new VFXItem(player.engine);
    const overlay = overlayItem.addComponent(UICanvas);

    overlay.order = -10;
    overlayItem.setParent(composition.root);
    player.engine.windowRoot.canvases.sortCanvases();
    expect(player.engine.windowRoot.canvases.children[0]).equals(overlay.rootControl);
    expect(player.engine.windowRoot.canvases.children[1]).equals(composition.uiCanvas.rootControl);
  });

  it('attaches and detaches a canvas through enable state', () => {
    composition.uiCanvas.enabled = false;
    expect(composition.uiCanvas.rootControl.parent).equals(null);

    composition.uiCanvas.enabled = true;
    expect(composition.uiCanvas.rootControl.parent).equals(player.engine.windowRoot.canvases);
  });

  it('synchronizes a canvas to the current window size when attaching late', () => {
    const canvasRoot = composition.uiCanvas.rootControl;

    composition.uiCanvas.enabled = false;
    player.engine.windowRoot.resize(640, 360);
    expect([canvasRoot.width, canvasRoot.height]).not.deep.equals([640, 360]);

    composition.uiCanvas.enabled = true;
    expect([canvasRoot.width, canvasRoot.height]).deep.equals([640, 360]);
  });

  it('detaches and disposes GUI objects with their bridge', () => {
    const item = new VFXItem(player.engine);
    const bridge = item.addComponent(UIControl);
    const control = new Control(player.engine);

    bridge.control = control;
    item.setParent(composition.sceneRoot);
    bridge.dispose();
    expect(control.isDisposed).equals(true);
    expect(control.parent).equals(null);
  });

  it('unlinks a Control without modifying or disposing it', () => {
    const item = new VFXItem(player.engine);
    const bridge = item.addComponent(UIControl);
    const control = new LifecycleControl(player.engine);

    bridge.control = control;
    item.setParent(composition.sceneRoot);
    const parent = control.parent;
    const owner = control.owner;
    const position = control.position;
    const size = control.size;

    bridge.unlinkControl();
    expect(bridge.control).equals(null);
    expect(control.parent).equals(parent);
    expect(control.owner).equals(owner);
    expect(control.position).equals(position);
    expect(control.size).equals(size);
    expect(control.isDisposed).equals(false);
    expect(control.destroyCount).equals(0);

    control.setPosition(20, 30);
    expect(item.transform.position.x).not.equals(20);
    expect(item.transform.position.y).not.equals(30);

    bridge.dispose();
    expect(control.parent).equals(parent);
    expect(control.isDisposed).equals(false);
    control.dispose();
    expect(control.destroyCount).equals(1);
  });

  it('uses only onDestroy for the Control lifecycle', () => {
    const item = new VFXItem(player.engine);
    const bridge = item.addComponent(UIControl);
    const control = new LifecycleControl(player.engine);

    bridge.control = control;
    item.setParent(composition.sceneRoot);
    expect('onAwake' in control).equals(false);
    expect(control.destroyCount).equals(0);

    bridge.dispose();
    expect(control.destroyCount).equals(1);
  });

  it('notifies the old Root only once when a Control is disposed', () => {
    const root = composition.uiCanvas.rootControl;
    const control = new Control(player.engine);

    root.addChild(control);
    chai.spy.on(player.engine.windowRoot, 'controlRemoved');
    control.dispose();
    expect(player.engine.windowRoot.controlRemoved).to.have.been.called.once;
  });
});
