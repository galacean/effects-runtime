import {
  CanvasItem,
  CanvasLayer,
  Composition,
  Control,
  FocusMode,
  InputEventMouseButton,
  MouseButton,
  Player,
  SubViewport,
  VFXItem,
} from '@galacean/effects';

const { expect } = chai;

class RecordingCanvasItem extends CanvasItem {
  label = '';
  output: string[] = [];

  override draw (): void {
    this.output.push(this.label);
  }
}

class RecordingControl extends Control {
  presses = 0;

  override onMouseDown (): void {
    this.presses++;
    this.acceptEvent();
  }
}

describe('core/components/canvas-topology', () => {
  let player: Player;

  before(() => {
    player = new Player({
      canvas: document.createElement('canvas'),
      manualRender: true,
      pixelRatio: 1,
      interactive: true,
    });
  });

  after(() => {
    player.dispose();
  });

  it('draws the default Canvas between negative and positive CanvasLayers', () => {
    const composition = new Composition(player.engine);
    const output: string[] = [];

    const negativeItem = new VFXItem(player.engine);
    const negativeLayer = negativeItem.addComponent(CanvasLayer);
    const negativeCanvasItem = negativeItem.addComponent(RecordingCanvasItem);

    negativeItem.setParent(composition.sceneRoot);
    negativeLayer.layer = -1;
    negativeCanvasItem.label = 'negative';
    negativeCanvasItem.output = output;

    const defaultItem = new VFXItem(player.engine);
    const defaultCanvasItem = defaultItem.addComponent(RecordingCanvasItem);

    defaultItem.setParent(composition.sceneRoot);
    defaultCanvasItem.label = 'default';
    defaultCanvasItem.output = output;

    const positiveItem = new VFXItem(player.engine);
    const positiveLayer = positiveItem.addComponent(CanvasLayer);
    const positiveCanvasItem = positiveItem.addComponent(RecordingCanvasItem);

    positiveItem.setParent(composition.sceneRoot);
    positiveCanvasItem.label = 'positive';
    positiveCanvasItem.output = output;

    activate(composition);

    expect(positiveLayer.layer).equals(1);
    expect(defaultCanvasItem.canvasLayer).equals(null);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(defaultCanvasItem);

    composition.viewport.renderCanvasLayers();
    expect(output).deep.equals(['negative', 'default', 'positive']);

    composition.dispose();
  });

  it('uses direct CanvasItem parents and respects CanvasLayer and Viewport boundaries', () => {
    const composition = new Composition(player.engine);
    const parentItem = new VFXItem(player.engine);
    const parentCanvasItem = parentItem.addComponent(CanvasItem);

    parentItem.setParent(composition.sceneRoot);

    const directItem = new VFXItem(player.engine);
    const directCanvasItem = directItem.addComponent(CanvasItem);

    directItem.setParent(parentItem);

    const bridgeItem = new VFXItem(player.engine);

    bridgeItem.setParent(parentItem);
    const brokenItem = new VFXItem(player.engine);
    const brokenCanvasItem = brokenItem.addComponent(CanvasItem);

    brokenItem.setParent(bridgeItem);

    const layerItem = new VFXItem(player.engine);
    const layer = layerItem.addComponent(CanvasLayer);
    const layerCanvasItem = layerItem.addComponent(CanvasItem);

    layerItem.setParent(parentItem);

    const viewportItem = new VFXItem(player.engine);
    const childViewport = viewportItem.addComponent(SubViewport);
    const viewportCanvasItem = viewportItem.addComponent(CanvasItem);

    viewportItem.setParent(parentItem);

    activate(composition);

    expect(directCanvasItem.parent).equals(parentCanvasItem);
    expect(brokenCanvasItem.parent).equals(null);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(parentCanvasItem);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(brokenCanvasItem);
    expect(composition.viewport.defaultCanvas.canvasItems).not.includes(directCanvasItem);

    expect(layerCanvasItem.parent).equals(null);
    expect(layerCanvasItem.canvasLayer).equals(layer);
    expect(layer.canvasItems).includes(layerCanvasItem);

    expect(viewportCanvasItem.parent).equals(null);
    expect(viewportCanvasItem.viewport).equals(childViewport);
    expect(childViewport.defaultCanvas.canvasItems).includes(viewportCanvasItem);

    directCanvasItem.topLevel = true;
    expect(directCanvasItem.parent).equals(null);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(directCanvasItem);

    composition.dispose();
  });

  it('uses CanvasLayer enabled as visibility without changing Canvas ownership', () => {
    const composition = new Composition(player.engine);
    const output: string[] = [];
    const layerItem = new VFXItem(player.engine);
    const layer = layerItem.addComponent(CanvasLayer);
    const canvasItemNode = new VFXItem(player.engine);
    const canvasItem = canvasItemNode.addComponent(RecordingCanvasItem);

    layer.enabled = false;
    layerItem.setParent(composition.sceneRoot);
    canvasItemNode.setParent(layerItem);
    canvasItem.label = 'layer';
    canvasItem.output = output;

    expect(composition.viewport.canvasLayers).includes(layer);
    expect(canvasItem.canvasLayer).equals(layer);
    expect(layer.canvasItems).includes(canvasItem);
    expect(composition.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);

    activate(composition);
    composition.viewport.renderCanvasLayers();
    expect(output).deep.equals([]);

    layer.enabled = true;
    expect(canvasItem.canvasLayer).equals(layer);
    expect(layer.canvasItems).includes(canvasItem);
    expect(composition.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);
    composition.viewport.renderCanvasLayers();
    expect(output).deep.equals(['layer']);

    output.length = 0;
    layer.enabled = false;
    expect(canvasItem.canvasLayer).equals(layer);
    expect(layer.canvasItems).includes(canvasItem);
    expect(composition.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);
    expect(canvasItem.isActiveInCanvasTree()).equals(false);
    composition.viewport.renderCanvasLayers();
    expect(output).deep.equals([]);

    layer.dispose();
    expect(canvasItem.canvasLayer).equals(null);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(canvasItem);

    composition.dispose();
  });

  it('drops GUI focus when its CanvasLayer is disabled without changing topology', () => {
    const composition = new Composition(player.engine);
    const layerItem = new VFXItem(player.engine);
    const layer = layerItem.addComponent(CanvasLayer);
    const controlItem = new VFXItem(player.engine);
    const control = controlItem.addComponent(RecordingControl);

    layerItem.setParent(composition.sceneRoot);
    controlItem.setParent(layerItem);
    activate(composition);

    control.focusMode = FocusMode.All;
    control.grabFocus();
    expect(composition.viewport.guiGetFocusOwner()).equals(control);

    layer.enabled = false;
    expect(composition.viewport.guiGetFocusOwner()).equals(null);
    expect(control.canvasLayer).equals(layer);
    expect(layer.canvasItems).includes(control);

    composition.dispose();
  });

  it('releases Canvas and Viewport registrations when disposed before playback', () => {
    const canvasItemNode = new VFXItem(player.engine);

    canvasItemNode.setParent(player.engine.root);
    const canvasItem = canvasItemNode.addComponent(CanvasItem);

    expect(player.engine.viewport.defaultCanvas.canvasItems).includes(canvasItem);
    canvasItem.dispose();
    expect(player.engine.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);

    const viewportNode = new VFXItem(player.engine);
    const viewport = viewportNode.addComponent(SubViewport);

    viewportNode.setParent(player.engine.root);
    expect(player.engine.getViewportsInRenderOrder()).includes(viewport);
    viewportNode.dispose();
    expect(viewport.isDisposed).equals(true);
    expect(player.engine.getViewportsInRenderOrder()).not.includes(viewport);
  });

  it('registers CanvasItems only after their VFXItem enters the runtime tree', () => {
    const item = new VFXItem(player.engine);
    const canvasItem = item.addComponent(CanvasItem);

    expect(item.isInsideTree).equals(false);
    expect(player.engine.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);

    item.setParent(player.engine.root);
    expect(item.isInsideTree).equals(true);
    expect(player.engine.viewport.defaultCanvas.canvasItems).includes(canvasItem);

    item.dispose();
    expect(player.engine.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);
  });

  it('activates a dynamically attached Viewport only after a real tree re-entry', () => {
    const composition = new Composition(player.engine);
    const reentryParent = new VFXItem(player.engine);
    const boundaryItem = new VFXItem(player.engine);
    const childItem = new VFXItem(player.engine);
    const canvasItem = childItem.addComponent(CanvasItem);

    boundaryItem.setParent(composition.sceneRoot);
    childItem.setParent(boundaryItem);
    activate(composition);

    expect(canvasItem.viewport).equals(composition.viewport);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(canvasItem);

    const childViewport = boundaryItem.addComponent(SubViewport);

    expect(childViewport.isActiveInTree).equals(false);
    expect(canvasItem.viewport).equals(composition.viewport);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(canvasItem);
    expect(childViewport.defaultCanvas.canvasItems).not.includes(canvasItem);

    reentryParent.setParent(composition.sceneRoot);
    boundaryItem.setParent(reentryParent);

    expect(childViewport.isActiveInTree).equals(true);
    expect(canvasItem.viewport).equals(childViewport);
    expect(composition.viewport.defaultCanvas.canvasItems).not.includes(canvasItem);
    expect(childViewport.defaultCanvas.canvasItems).includes(canvasItem);

    childViewport.dispose();
    expect(canvasItem.viewport).equals(composition.viewport);
    expect(childViewport.defaultCanvas.canvasItems).not.includes(canvasItem);
    expect(composition.viewport.defaultCanvas.canvasItems).includes(canvasItem);

    composition.dispose();
  });

  it('removes GUI state from the old Viewport when a Control crosses compositions', () => {
    const first = new Composition(player.engine);
    const second = new Composition(player.engine);
    const item = new VFXItem(player.engine);
    const control = item.addComponent(Control);

    item.setParent(first.sceneRoot);
    activate(first);
    activate(second);

    control.transform.setSize(100, 100);
    control.focusMode = FocusMode.All;
    control.grabFocus();

    expect(control.viewport).equals(first.viewport);
    expect(first.viewport.defaultCanvas.canvasItems).includes(control);
    expect(first.viewport.guiGetFocusOwner()).equals(control);

    item.setParent(second.sceneRoot);

    expect(control.viewport).equals(second.viewport);
    expect(first.viewport.defaultCanvas.canvasItems).not.includes(control);
    expect(second.viewport.defaultCanvas.canvasItems).includes(control);
    expect(first.viewport.guiGetFocusOwner()).equals(null);

    control.grabFocus();
    expect(second.viewport.guiGetFocusOwner()).equals(control);

    second.dispose();
    first.dispose();
  });

  it('routes Window input through the real Viewport tree in front-to-back order', () => {
    const back = new Composition(player.engine);
    const front = new Composition(player.engine);
    const backItem = new VFXItem(player.engine);
    const frontItem = new VFXItem(player.engine);
    const backControl = backItem.addComponent(RecordingControl);
    const frontControl = frontItem.addComponent(RecordingControl);

    backItem.setParent(back.sceneRoot);
    frontItem.setParent(front.sceneRoot);
    back.setIndex(0);
    front.setIndex(1);
    activate(back);
    activate(front);
    backControl.transform.setSize(100, 100);
    frontControl.transform.setSize(100, 100);

    player.engine.viewport.pushInput(mouseButton(true));
    expect(frontControl.presses).equals(1);
    expect(backControl.presses).equals(0);
    expect(player.engine.viewport.isInputHandled()).equals(true);
    player.engine.viewport.pushInput(mouseButton(false));

    front.interactive = false;
    player.engine.viewport.pushInput(mouseButton(true));
    expect(frontControl.presses).equals(1);
    expect(backControl.presses).equals(1);
    player.engine.viewport.pushInput(mouseButton(false));

    front.dispose();
    back.dispose();
  });
});

function activate (composition: Composition): void {
  composition.root.awake();
  composition.root.beginPlay();
}

function mouseButton (pressed: boolean): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.buttonIndex = MouseButton.Left;
  event.pressed = pressed;
  event.position.set(10, 10);
  event.globalPosition.set(10, 10);

  return event;
}
