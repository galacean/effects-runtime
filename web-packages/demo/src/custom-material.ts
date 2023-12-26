import type { Composition, VFXItem, SpriteComponent, SceneLoadType, Deserializer } from '@galacean/effects';
import { EffectComponent, Player } from '@galacean/effects';
import json, { sceneData } from './assets/custom-material';

const container = document.getElementById('J-container');

let deserializer: Deserializer;
let testVfxItem: VFXItem<SpriteComponent>;

//@ts-expect-error
let gui;

// const properties = `
// _2D("2D", 2D) = "" {}
// _Color("Color",Color) = (1,1,1,1)
// _Value("Value",Range(0,10)) = 2.5
// _Float("Float",Float) = 0
// _Vector("Vector",Vector) = (0,0,0,0)
// _Rect("Rect",Rect) = "" {}
// _Cube("Cube",Cube) = "" {}
// `;

(async () => {
  try {
    const player = new Player({ container });
    const composition = await player.loadScene(json as SceneLoadType);

    deserializer = composition.deserializer;
    testVfxItem = composition.getItemByName('Trail1') as VFXItem<any>;
    // testVfxItem.fromData(deserializer, json.vfxItems['1'], ecsSceneJsonDemo);
    // composition.content.items.push(testVfxItem);
    // composition.content.rootItems.push(testVfxItem);
    setGUI();
    // testVfxItem.fromData(deserializer, ecsSceneJsonDemo.vfxItems['1'], ecsSceneJsonDemo);
    // testVfxItem.start();
    // testVfxItem.composition = composition;
  } catch (e) {
    console.error('biz', e);
  }
})();

function parseMaterialProperties (shaderProperties: string, gui: any) {
  json.materials[0].floats = {};
  const lines = shaderProperties.split('\n');

  for (const property of lines) {
    // 提取材质属性信息
    // 如 “_Float1("Float2", Float) = 0”
    // 提取出 “_Float1” “Float2” “Float” “0”
    const regex = /\s*(.+?)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/;
    const matchResults = property.match(regex);

    if (!matchResults) {
      return;
    }
    const uniformName = matchResults[1];
    const inspectorName = matchResults[2];
    const type = matchResults[3];
    const value = matchResults[4];

    // 提取 Range(a, b) 的 a 和 b
    const match = type.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);

      //@ts-expect-error
      json.materials[0].floats[uniformName] = Number(value);
      gui.add(json.materials[0].floats, uniformName, start, end).onChange(() => {
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    } else if (type === 'Float') {
      //@ts-expect-error
      json.materials[0].floats[uniformName] = Number(value);
      gui.add(json.materials[0].floats, uniformName).onChange(() => {
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    } else if (type === 'Color') {
      const Color: Record<string, number[]> = {};

      Color[uniformName] = [0, 0, 0, 0];
      gui.addColor(Color, uniformName).name(inspectorName).onChange((value: number[]) => {
        //@ts-expect-error
        json.materials[0].vector4s[uniformName] = [value[0] / 255, value[1] / 255, value[2] / 255, value[3] / 255];
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    }
  }
}

// dat gui 参数及修改
function setDatGUI (materialProperties: string) {
  //@ts-expect-error
  if (gui) {
    gui.destroy();
  }
  //@ts-expect-error
  gui = new dat.GUI();
  const materialGUI = gui.addFolder('Material');

  parseMaterialProperties(materialProperties, gui);
  materialGUI.open();

  // @ts-expect-error
  gui.add(json.components[0].materials[0], 'id', { material1:'21', material2:'22', material3:'23' }).name('Material').onChange(()=>{
    testVfxItem.getComponent(EffectComponent)!.fromData(json.components[0], deserializer, sceneData);
  });
}

function setGUI () {
  const vsInput = document.getElementById('vs-input') as HTMLTextAreaElement;
  const fsInput = document.getElementById('fs-input') as HTMLTextAreaElement;
  const propertiesInput = document.getElementById('properties-input') as HTMLTextAreaElement;
  const compileButton = document.getElementById('J-compileBtn') as HTMLButtonElement;

  vsInput.value = json.shaders[0].vertex;
  fsInput.value = json.shaders[0].fragment;
  propertiesInput.value = `_StartColor("StartColor",Color) = (1,1,1,1)
_EndColor("EndColor",Color) = (1,1,1,1)`;

  compileButton.addEventListener('click', () => {
    json.shaders[0].vertex = vsInput.value;
    json.shaders[0].fragment = fsInput.value;
    setDatGUI(propertiesInput.value);
    testVfxItem.getComponent(EffectComponent)!.fromData(json.components[0], deserializer, sceneData);
  });
  setDatGUI(propertiesInput.value);
}
