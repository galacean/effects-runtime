import {
  Composition,
  ContainerControl,
  Control,
  Player,
  RootControl,
  UICanvas,
  UIControl,
  VFXItem,
} from '@galacean/effects';

const { expect } = chai;

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
    expect(composition.uiCanvas.rootControl).instanceOf(ContainerControl);
    expect(composition.uiCanvas.rootControl).not.instanceOf(RootControl);
    expect(player.engine.windowRoot.canvases.parent).equals(player.engine.windowRoot);
    expect(composition.sceneRoot.getComponent(UICanvas)).equals(composition.uiCanvas);
    expect(composition.uiCanvas.rootControl.parent).equals(player.engine.windowRoot.canvases);
    expect(composition.uiCanvas.rootControl.root).equals(player.engine.windowRoot);
  });

  it('builds a GUI tree through UIControl bridges', () => {
    const parentItem = new VFXItem(player.engine);
    const parentBridge = parentItem.addComponent(UIControl);
    const parentControl = new ContainerControl(player.engine);

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
    const transform = control.transform;

    bridge.unlinkControl();
    expect(bridge.control).equals(null);
    expect(control.parent).equals(parent);
    expect(control.owner).equals(owner);
    expect(control.transform).equals(transform);
    expect(control.isDisposed).equals(false);
    expect(control.destroyCount).equals(0);

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
