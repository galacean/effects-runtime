import { Player } from '@galacean/effects';
import { TreeGui } from '../gui/tree-gui';
import { InspectorGui } from '../gui/inspector-gui';
import { Input } from '../gui/input';
import { OrbitController } from '../gui/orbit-controller';
import json from '../assets/scenes/trail-demo2.scene.json';

export const treeGui = new TreeGui();
const inspectorGui = new InspectorGui();
let input: Input;
let orbitController: OrbitController;

export async function initGEPlayer (canvas: HTMLCanvasElement) {
  const player = new Player({ canvas, interactive: true, notifyTouch: true });
  //@ts-expect-error
  const comp = await player.loadScene(json);

  treeGui.setComposition(comp);
  input = new Input(canvas);
  input.startup();
  orbitController = new OrbitController(comp.camera, input);
  inputControllerUpdate();

  setInterval(() => {
    guiMainLoop();
  }, 100);
}

function guiMainLoop () {
  if (treeGui.activeItem) {
    inspectorGui.setItem(treeGui.activeItem);
  }
  treeGui.update();
  inspectorGui.update();
}

function inputControllerUpdate () {
  orbitController.update();
  input.refreshStatus();
  requestAnimationFrame(inputControllerUpdate);
}