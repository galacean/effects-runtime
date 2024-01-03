import type { Deserializer, VFXItem, VFXItemContent } from '@galacean/effects';
import { Player } from '@galacean/effects';
import json from './assets/custom-material';
import { Input } from './gui/input';
import { InspectorGui } from './gui/inspector-gui';
import { OrbitController } from './gui/orbit-controller';
import { TreeGui } from './gui/tree-gui';

const container = document.getElementById('J-container');
const treeGui = new TreeGui();
const inspectorGui = new InspectorGui();

export let deserializer: Deserializer;
export let testVfxItem: VFXItem<VFXItemContent>;
let orbitController: OrbitController;
let input: Input;

(async () => {
  try {
    const player = new Player({ container });
    //@ts-expect-error
    const composition = await player.loadScene(json);

    treeGui.setComposition(composition);
    input = new Input(container!);
    input.startup();
    orbitController = new OrbitController(composition.camera, input);

    inputControllerUpdate();

    deserializer = composition.deserializer;
    testVfxItem = composition.getItemByName('Trail1')!;
  } catch (e) {
    console.error('biz', e);
  }
})();

setInterval(()=>{
  guiMainLoop();
}, 100);

// const properties = `
// _2D("2D", 2D) = "" {}
// _Color("Color",Color) = (1,1,1,1)
// _Value("Value",Range(0,10)) = 2.5
// _Float("Float",Float) = 0
// _Vector("Vector",Vector) = (0,0,0,0)
// _Rect("Rect",Rect) = "" {}
// _Cube("Cube",Cube) = "" {}
// `;

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
